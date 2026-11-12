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
  needsWelcome,
  type OnboardingGoalValue,
  type OnboardingState,
} from "@/lib/onboarding-flow";

/** #onboarding: reading and writing a person's welcome-flow state. */

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
 * Whether /home sends this person to /welcome. A super admin is made owner of
 * the main organisation automatically at sign-in (ensureZeduOwnerMembership),
 * so that membership doesn't make a brand-new super admin look like someone
 * who joined a team; any other organisation still does.
 */
export async function shouldShowWelcome(user: {
  id: string;
  role: Parameters<typeof isSuperAdmin>[0];
  email?: string | null;
}): Promise<boolean> {
  const superAdmin = isSuperAdmin(user.role) || isSuperAdminEmail(user.email);
  const [row, membership] = await Promise.all([
    loadOnboarding(user.id),
    prisma.membership.findFirst({
      where: { userId: user.id, ...(superAdmin ? { organisation: { slug: { not: ZEDU_SLUG } } } : {}) },
      select: { organisationId: true },
    }),
  ]);
  return needsWelcome(row, Boolean(membership));
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

/** Whether the app shell shows the first-experience feedback prompt for this person. */
export async function shouldShowFeedbackPrompt(userId: string, now = new Date()): Promise<boolean> {
  const [row, feedback] = await Promise.all([
    loadOnboarding(userId),
    prisma.onboardingFeedback.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  return feedbackPromptVisible(row, Boolean(feedback), now);
}
