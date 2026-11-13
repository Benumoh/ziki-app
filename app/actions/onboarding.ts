"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth-helpers";
import { appCookieOptions } from "@/lib/cookie-options";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { withDismissed } from "@/lib/onboarding";
import { NEXT_STEP_COOKIE, NEXT_STEP_COOKIE_MAX_AGE } from "@/lib/organisation-next-step";
import { checklistLinkPath, snoozeFeedback } from "@/lib/onboarding-flow";
import { recordOnboardingEvent, startOnboarding } from "@/lib/onboarding-state";
import {
  onboardingFeedbackSchema,
  onboardingProgressSchema,
  onboardingTaskSchema,
} from "@/lib/validations/onboarding";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

/** Hide the next-step card (#agents-dock) for one organisation on this device. */
export async function dismissNextStepAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const organisationId = String(formData.get("organisationId") ?? "");
  if (!organisationId) return;
  const member = await prisma.membership.findUnique({
    where: { organisationId_userId: { organisationId, userId: user.id } },
    select: { organisationId: true },
  });
  if (!member) return;
  const jar = await cookies();
  jar.set(
    NEXT_STEP_COOKIE,
    withDismissed(jar.get(NEXT_STEP_COOKIE)?.value, organisationId),
    appCookieOptions(NEXT_STEP_COOKIE_MAX_AGE),
  );
  revalidatePath("/[project]", "layout");
}

export type OnboardingActionResult = { ok: true; duplicate?: boolean } | { ok: false; error: string; field?: string };

const SAVE_FAILED = "We couldn't save your progress. Check your connection and try again.";

/** #onboarding: remember the step and goal so leaving midway resumes here. */
export async function saveOnboardingProgressAction(input: {
  step: number;
  goal?: string | null;
}): Promise<OnboardingActionResult> {
  const user = await requireUser();
  const parsed = onboardingProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That step isn't part of the welcome flow." };
  try {
    await startOnboarding(user.id);
    await prisma.userOnboarding.updateMany({
      // A finished flow keeps its final state.
      where: { userId: user.id, completedAt: null, skippedAt: null },
      data: {
        step: parsed.data.step,
        ...(parsed.data.goal !== undefined ? { goal: parsed.data.goal } : {}),
      },
    });
    return { ok: true };
  } catch (error) {
    logger.error("[onboarding] save progress failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
}

/** #onboarding: leave the welcome flow for the normal app; it won't show again. */
export async function skipOnboardingAction(): Promise<OnboardingActionResult> {
  const user = await requireUser();
  try {
    const row = await startOnboarding(user.id);
    const { count } = await prisma.userOnboarding.updateMany({
      where: { userId: user.id, completedAt: null, skippedAt: null },
      data: { skippedAt: new Date() },
    });
    // A second click finds the flow already finished and records nothing more.
    if (count > 0) await recordOnboardingEvent(user.id, "onboarding_skipped", row.goal);
  } catch (error) {
    logger.error("[onboarding] skip failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
  // The app layout re-renders so the feedback prompt can appear on the next page.
  revalidatePath("/", "layout");
  redirect("/home");
}

/**
 * #onboarding: a welcome checklist button that leads out of the page. Taking
 * that first step finishes the welcome flow (so /home stops sending them back)
 * and goes where the button says; only paths from the checklist are allowed.
 */
export async function startChecklistTaskAction(input: { task: string; link: string }): Promise<OnboardingActionResult> {
  const user = await requireUser();
  const parsed = onboardingTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That isn't part of the welcome checklist." };
  const { task, link } = parsed.data;
  try {
    const row = await startOnboarding(user.id);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.userOnboarding.updateMany({
        where: { userId: user.id, completedAt: null, skippedAt: null },
        data: { completedAt: now, firstActionAt: now },
      });
      if (count > 0) {
        await tx.onboardingEvent.createMany({
          data: [
            { userId: user.id, name: "onboarding_completed", goal: row.goal },
            { userId: user.id, name: "first_action", goal: row.goal },
          ],
        });
      }
    });
  } catch (error) {
    logger.error("[onboarding] checklist task failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
  revalidatePath("/", "layout");
  redirect(checklistLinkPath(task, link));
}

/** #onboarding: the first-experience rating. One per person; a repeat click changes nothing. */
export async function submitOnboardingFeedbackAction(formData: FormData): Promise<OnboardingActionResult> {
  const user = await requireUser();
  const parsed = onboardingFeedbackSchema.safeParse({
    rating: formData.get("rating") ?? undefined,
    comment: formData.get("comment") ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check your feedback and try again.", field: String(issue?.path[0] ?? "rating") };
  }
  const limit = await consumeRateLimit(`onboarding-feedback:${user.id}`, { max: 5, windowMs: 60 * 1000 });
  if (!limit.allowed) return { ok: false, error: RATE_LIMIT_MESSAGE };

  try {
    const row = await prisma.userOnboarding.findUnique({ where: { userId: user.id }, select: { goal: true } });
    await prisma.$transaction(async (tx) => {
      await tx.onboardingFeedback.create({
        data: { userId: user.id, rating: parsed.data.rating, comment: parsed.data.comment, goal: row?.goal ?? null },
      });
      await tx.onboardingEvent.create({ data: { userId: user.id, name: "feedback_submitted", goal: row?.goal ?? null } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Already sent (a double click, or another tab): the first one stands.
      return { ok: true, duplicate: true };
    }
    logger.error("[onboarding] feedback failed", error);
    return { ok: false, error: "We couldn't send your feedback. Your answers are still here; try again." };
  }
  // No layout refresh here: the card shows its thank-you itself, and the next
  // full page load doesn't render the prompt at all.
  return { ok: true };
}

/** #onboarding: "Maybe later" on the feedback prompt. Never counts against anything. */
export async function dismissOnboardingFeedbackAction(): Promise<OnboardingActionResult> {
  const user = await requireUser();
  try {
    const row = await prisma.userOnboarding.findUnique({
      where: { userId: user.id },
      select: { feedbackSnoozeCount: true, feedbackClosedAt: true, goal: true },
    });
    if (!row || row.feedbackClosedAt) return { ok: true };
    await prisma.userOnboarding.update({ where: { userId: user.id }, data: snoozeFeedback(row) });
    await recordOnboardingEvent(user.id, "feedback_dismissed", row.goal);
  } catch (error) {
    logger.error("[onboarding] feedback dismiss failed", error);
    // Hiding the prompt still works on this page; nothing for the person to fix.
    return { ok: false, error: SAVE_FAILED };
  }
  return { ok: true };
}
