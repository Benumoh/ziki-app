import "server-only";
import { Prisma, type OnboardingEventName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ZEDU_SLUG } from "@/lib/organisation";
import { isSuperAdmin } from "@/lib/roles";
import { isSuperAdminEmail } from "@/lib/super-admin";
import {
  feedbackPromptVisible,
  isOnboardingGoal,
  welcomeDue,
  type ChecklistStatus,
  type OnboardingGoalValue,
  type OnboardingState,
} from "@/lib/onboarding-flow";

/** #onboarding: reading and writing a person's welcome-flow state. */

/**
 * Testing mode: ONBOARDING_ALWAYS_SHOW=true shows the welcome flow to everyone
 * once per browser session, finished or not. Off unless set.
 */
export function onboardingAlwaysShown(): boolean {
  return process.env.ONBOARDING_ALWAYS_SHOW?.trim().toLowerCase() === "true";
}

export const ONBOARDING_SELECT = {
  step: true,
  goal: true,
  completedAt: true,
  skippedAt: true,
  feedbackSnoozedUntil: true,
  feedbackSnoozeCount: true,
  feedbackClosedAt: true,
} as const;

export type OnboardingRow = OnboardingState & { step: number; goal: OnboardingGoalValue | null };

function toRow(row: Prisma.UserOnboardingGetPayload<{ select: typeof ONBOARDING_SELECT }>): OnboardingRow {
  return { ...row, goal: isOnboardingGoal(row.goal) ? row.goal : null };
}

export async function loadOnboarding(userId: string): Promise<OnboardingRow | null> {
  const row = await prisma.userOnboarding.findUnique({ where: { userId }, select: ONBOARDING_SELECT });
  return row ? toRow(row) : null;
}

/**
 * #onboarding: which welcome checklist tasks are done, read from real data. A
 * super admin's automatic main-organisation ownership doesn't count as joining one.
 */
export async function loadChecklistStatus(
  user: { id: string; role: Parameters<typeof isSuperAdmin>[0]; email?: string | null },
  goal: string | null,
): Promise<ChecklistStatus> {
  const superAdmin = isSuperAdmin(user.role) || isSuperAdminEmail(user.email);
  const [membership, project, agent] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId: user.id, ...(superAdmin ? { organisation: { slug: { not: ZEDU_SLUG } } } : {}) },
      select: { organisationId: true },
    }),
    prisma.projectMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
    prisma.agent.findFirst({ where: { ownerUserId: user.id, revokedAt: null }, select: { id: true } }),
  ]);
  return {
    account: true,
    goal: Boolean(goal),
    organisation: Boolean(membership),
    project: Boolean(project),
    agent: Boolean(agent),
  };
}

/**
 * Whether /home sends this person to /welcome. A super admin is made owner of
 * the main organisation automatically at sign-in (ensureZeduOwnerMembership),
 * so that membership doesn't make a brand-new super admin look like someone
 * who joined a team; any other organisation still does.
 */
export async function shouldShowWelcome(
  user: {
    id: string;
    role: Parameters<typeof isSuperAdmin>[0];
    email?: string | null;
  },
  { seenThisSession = false }: { seenThisSession?: boolean } = {},
): Promise<boolean> {
  if (onboardingAlwaysShown()) return welcomeDue(null, false, { alwaysShow: true, seenThisSession });
  const superAdmin = isSuperAdmin(user.role) || isSuperAdminEmail(user.email);
  const [row, membership] = await Promise.all([
    loadOnboarding(user.id),
    prisma.membership.findFirst({
      where: { userId: user.id, ...(superAdmin ? { organisation: { slug: { not: ZEDU_SLUG } } } : {}) },
      select: { organisationId: true },
    }),
  ]);
  return welcomeDue(row, Boolean(membership), { alwaysShow: false, seenThisSession });
}

/**
 * The person's row, made on their first visit to /welcome. Making it records
 * signup completed and onboarding started once; a second render (a refresh,
 * two tabs) finds the row and records nothing.
 */
export async function startOnboarding(userId: string): Promise<OnboardingRow> {
  const existing = await loadOnboarding(userId);
  if (existing) return existing;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.userOnboarding.create({ data: { userId }, select: ONBOARDING_SELECT });
      await tx.onboardingEvent.createMany({
        data: [
          { userId, name: "signup_completed" },
          { userId, name: "onboarding_started" },
        ],
      });
      return row;
    });
    return toRow(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await loadOnboarding(userId);
      if (row) return row;
    }
    throw error;
  }
}

/** Records one funnel step. Analytics never breaks the flow it measures. */
export async function recordOnboardingEvent(
  userId: string,
  name: OnboardingEventName,
  goal: OnboardingGoalValue | null = null,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  try {
    await client.onboardingEvent.create({ data: { userId, name, goal } });
  } catch (error) {
    logger.error("[onboarding] could not record event", { name, error });
  }
}

/**
 * #getting-started: records a step a newcomer reaches inside their first project (the site saved, the first idea
 * posted), once per person. Only people who signed up since the funnel began count (they have signup_completed),
 * so older accounts doing the same thing don't skew it. Returns whether it was recorded now.
 */
export async function recordFirstProjectStep(
  userId: string,
  name: Extract<OnboardingEventName, "website_saved" | "first_idea_posted">,
): Promise<boolean> {
  try {
    const [signedUp, already, row] = await Promise.all([
      prisma.onboardingEvent.findFirst({ where: { userId, name: "signup_completed" }, select: { id: true } }),
      prisma.onboardingEvent.findFirst({ where: { userId, name }, select: { id: true } }),
      loadOnboarding(userId),
    ]);
    if (!signedUp || already) return false;
    await prisma.onboardingEvent.create({ data: { userId, name, goal: row?.goal ?? null } });
    return true;
  } catch (error) {
    // Analytics never breaks the action it measures.
    logger.error("[onboarding] could not record project step", { name, error });
    return false;
  }
}

/** Whether the app shell shows the first-experience feedback prompt for this person. */
export async function shouldShowFeedbackPrompt(userId: string, now = new Date()): Promise<boolean> {
  const [row, feedback, idea] = await Promise.all([
    loadOnboarding(userId),
    prisma.onboardingFeedback.findUnique({ where: { userId }, select: { id: true } }),
    prisma.idea.findFirst({ where: { reporterId: userId }, select: { id: true } }),
  ]);
  return feedbackPromptVisible(row, Boolean(feedback), now, { postedIdea: Boolean(idea) });
}
