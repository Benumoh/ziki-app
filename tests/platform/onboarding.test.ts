import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * #onboarding: who sees the welcome flow and the feedback prompt, where
 * finishing it sends them, and the server actions behind it: complete, skip,
 * resume, feedback, and what a double click or a bad request does.
 */
const requireUser = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const startOnboarding = vi.hoisted(() => vi.fn());
const recordOnboardingEvent = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  userOnboarding: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  onboardingEvent: { create: vi.fn(), createMany: vi.fn() },
  onboardingFeedback: { create: vi.fn() },
  membership: { findUnique: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("next/navigation", () => ({ redirect }));
const cookieSet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet, get: vi.fn() })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/onboarding-state", () => ({ startOnboarding, recordOnboardingEvent }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit, RATE_LIMIT_MESSAGE: "Slow down." }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import {
  dismissOnboardingFeedbackAction,
  startChecklistTaskAction,
  saveOnboardingProgressAction,
  skipOnboardingAction,
  submitOnboardingFeedbackAction,
} from "@/app/actions/onboarding";
import {
  FEEDBACK_MAX_SNOOZES,
  FEEDBACK_WAIT_MS,
  feedbackPromptVisible,
  checklistProgress,
  openTaskFor,
  type ChecklistStatus,
  needsWelcome,
  snoozeFeedback,
  type OnboardingState,
} from "@/lib/onboarding-flow";

const now = new Date("2026-11-12T10:00:00Z");
const fresh: OnboardingState = {
  completedAt: null,
  skippedAt: null,
  feedbackSnoozedUntil: null,
  feedbackSnoozeCount: 0,
  feedbackClosedAt: null,
};
const finished: OnboardingState = { ...fresh, completedAt: now };

function feedbackForm(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", role: "user" });
  startOnboarding.mockResolvedValue({ ...fresh, step: 0, goal: null });
  consumeRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  db.$transaction.mockImplementation((work: (tx: typeof db) => unknown) => work(db));
  db.userOnboarding.updateMany.mockResolvedValue({ count: 1 });
  db.userOnboarding.findUnique.mockResolvedValue({ goal: "explore_projects", feedbackSnoozeCount: 0, feedbackClosedAt: null });
});

describe("who sees the welcome flow", () => {
  it("sends a brand-new account with no organisation to the welcome flow", () => {
    expect(needsWelcome(null, false)).toBe(true);
  });

  it("leaves someone already in an organisation (an invite) on the normal app", () => {
    expect(needsWelcome(null, true)).toBe(false);
  });

  it("brings back someone who left midway, and never someone who finished or skipped", () => {
    expect(needsWelcome(fresh, true)).toBe(true);
    expect(needsWelcome(finished, false)).toBe(false);
    expect(needsWelcome({ ...fresh, skippedAt: now }, false)).toBe(false);
  });

  it("opens the checklist on the goal picker, then on the chosen goal's task, then the first one left", () => {
    const start: ChecklistStatus = { account: true, goal: false, organisation: false, project: false, agent: false };
    expect(openTaskFor(start, null)).toBe("goal");
    const withGoal = { ...start, goal: true };
    expect(openTaskFor(withGoal, "work_with_agents")).toBe("agent");
    expect(openTaskFor(withGoal, "contribute_issues")).toBe("project");
    expect(openTaskFor({ ...withGoal, agent: true }, "work_with_agents")).toBe("organisation");
    expect(openTaskFor({ account: true, goal: true, organisation: true, project: true, agent: true }, "explore_projects")).toBeNull();
  });

  it("counts progress from what's actually done", () => {
    expect(checklistProgress({ account: true, goal: true, organisation: false, project: true, agent: false })).toEqual({ done: 3, total: 5 });
  });
});

describe("who is new at /home", () => {
  async function realShouldShowWelcome() {
    const actual = await vi.importActual<typeof import("@/lib/onboarding-state")>("@/lib/onboarding-state");
    return actual.shouldShowWelcome;
  }

  it("still welcomes a brand-new super admin, whose main-organisation ownership is automatic", async () => {
    const shouldShowWelcome = await realShouldShowWelcome();
    db.userOnboarding.findUnique.mockResolvedValue(null);
    db.membership.findFirst.mockResolvedValue(null);
    await expect(shouldShowWelcome({ id: "admin-1", role: "super_admin", email: "admin@example.com" })).resolves.toBe(true);
    expect(db.membership.findFirst).toHaveBeenCalledWith({
      where: { userId: "admin-1", organisation: { slug: { not: "zedu" } } },
      select: { organisationId: true },
    });
  });

  it("doesn't welcome a super admin who also belongs to another organisation", async () => {
    const shouldShowWelcome = await realShouldShowWelcome();
    db.userOnboarding.findUnique.mockResolvedValue(null);
    db.membership.findFirst.mockResolvedValue({ organisationId: "org-2" });
    await expect(shouldShowWelcome({ id: "admin-1", role: "super_admin" })).resolves.toBe(false);
  });

  it("in always-show testing mode, shows everyone the flow once per browser session", async () => {
    const shouldShowWelcome = await realShouldShowWelcome();
    vi.stubEnv("ONBOARDING_ALWAYS_SHOW", "true");
    try {
      // A finished, long-standing member still gets it on a new visit…
      db.userOnboarding.findUnique.mockResolvedValue({ ...finished, step: 2, goal: "explore_projects" });
      db.membership.findFirst.mockResolvedValue({ organisationId: "org-1" });
      await expect(shouldShowWelcome({ id: "member-1", role: "user" })).resolves.toBe(true);
      // …but not again after leaving it this session, so /home doesn't loop.
      await expect(shouldShowWelcome({ id: "member-1", role: "user" }, { seenThisSession: true })).resolves.toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
    // Off again: the normal rule applies.
    await expect(shouldShowWelcome({ id: "member-1", role: "user" })).resolves.toBe(false);
  });

  it("counts every membership, the main organisation included, for everyone else", async () => {
    const shouldShowWelcome = await realShouldShowWelcome();
    db.userOnboarding.findUnique.mockResolvedValue(null);
    db.membership.findFirst.mockResolvedValue({ organisationId: "zedu-org" });
    await expect(shouldShowWelcome({ id: "member-1", role: "user" })).resolves.toBe(false);
    expect(db.membership.findFirst).toHaveBeenCalledWith({ where: { userId: "member-1" }, select: { organisationId: true } });
  });
});

describe("the feedback prompt", () => {
  it("shows only after the welcome flow, and never once feedback is sent", () => {
    const posted = { postedIdea: true };
    expect(feedbackPromptVisible(fresh, false, now, posted)).toBe(false);
    expect(feedbackPromptVisible(finished, false, now, posted)).toBe(true);
    expect(feedbackPromptVisible({ ...fresh, skippedAt: now }, false, now, posted)).toBe(true);
    expect(feedbackPromptVisible(finished, true, now, posted)).toBe(false);
  });

  it("asks once there is something to rate: right after the first idea, or a day after the welcome", () => {
    // Just finished the welcome, nothing posted yet: not yet.
    expect(feedbackPromptVisible(finished, false, now)).toBe(false);
    // The first idea is in: straight away.
    expect(feedbackPromptVisible(finished, false, now, { postedIdea: true })).toBe(true);
    // No idea, but a day has passed since the welcome: now.
    expect(feedbackPromptVisible(finished, false, new Date(now.getTime() + FEEDBACK_WAIT_MS))).toBe(true);
  });

  it("stays hidden while snoozed, then for good after the last 'Maybe later'", () => {
    const first = { ...finished, ...snoozeFeedback(finished, now) };
    expect(feedbackPromptVisible(first, false, now)).toBe(false);
    expect(feedbackPromptVisible(first, false, new Date(now.getTime() + 4 * 24 * 3600 * 1000))).toBe(true);
    const last = { ...first, ...snoozeFeedback(first, now) };
    expect(last.feedbackSnoozeCount).toBe(FEEDBACK_MAX_SNOOZES);
    expect(last.feedbackClosedAt).toEqual(now);
    expect(feedbackPromptVisible(last, false, new Date(now.getTime() + 365 * 24 * 3600 * 1000))).toBe(false);
  });

  it("never shows for accounts that existed before onboarding (backfilled closed)", () => {
    expect(feedbackPromptVisible({ ...finished, feedbackClosedAt: now }, false, now)).toBe(false);
  });
});

describe("welcome flow actions", () => {
  it("a checklist button finishes the flow once and goes where the button says", async () => {
    await expect(startChecklistTaskAction({ task: "agent", link: "primary" })).rejects.toThrow("NEXT_REDIRECT:/settings/connect");
    expect(db.userOnboarding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", completedAt: null, skippedAt: null } }),
    );
    expect(db.onboardingEvent.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", name: "onboarding_completed", goal: null },
        { userId: "user-1", name: "first_action", goal: null },
      ],
    });
    await expect(startChecklistTaskAction({ task: "organisation", link: "secondary" })).rejects.toThrow(
      "NEXT_REDIRECT:/organisations?open=join",
    );
  });

  it("a second click records nothing more but still goes on", async () => {
    db.userOnboarding.updateMany.mockResolvedValue({ count: 0 });
    await expect(startChecklistTaskAction({ task: "project", link: "primary" })).rejects.toThrow("NEXT_REDIRECT:/discover");
    expect(db.onboardingEvent.createMany).not.toHaveBeenCalled();
  });

  it("only goes to the checklist's own places, and writes nothing otherwise", async () => {
    for (const input of [
      { task: "account", link: "primary" },
      { task: "agent", link: "https://evil.example" },
    ]) {
      await expect(startChecklistTaskAction(input)).resolves.toMatchObject({ ok: false });
    }
    expect(db.userOnboarding.updateMany).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("skipping goes to the normal app and is recorded once", async () => {
    await expect(skipOnboardingAction()).rejects.toThrow("NEXT_REDIRECT:/home");
    expect(recordOnboardingEvent).toHaveBeenCalledWith("user-1", "onboarding_skipped", null);
    recordOnboardingEvent.mockClear();
    db.userOnboarding.updateMany.mockResolvedValue({ count: 0 });
    await expect(skipOnboardingAction()).rejects.toThrow("NEXT_REDIRECT:/home");
    expect(recordOnboardingEvent).not.toHaveBeenCalled();
  });

  it("saves progress for resuming, and rejects a step outside the flow", async () => {
    await expect(saveOnboardingProgressAction({ step: 1, goal: "contribute_issues" })).resolves.toEqual({ ok: true });
    expect(db.userOnboarding.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", completedAt: null, skippedAt: null },
      data: { step: 1, goal: "contribute_issues" },
    });
    const bad = await saveOnboardingProgressAction({ step: 7 });
    expect(bad.ok).toBe(false);
  });

  it("tells the person when saving fails instead of losing their place silently", async () => {
    db.userOnboarding.updateMany.mockRejectedValue(new Error("db down"));
    const result = await saveOnboardingProgressAction({ step: 2, goal: "explore_projects" });
    expect(result).toMatchObject({ ok: false });
  });
});

describe("first-experience feedback", () => {
  it("stores the rating for the signed-in person, whatever the form claims", async () => {
    const result = await submitOnboardingFeedbackAction(feedbackForm({ rating: "4", comment: "  Goal step was clear  ", userId: "someone-else" }));
    expect(result).toEqual({ ok: true });
    expect(db.onboardingFeedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1", rating: 4, comment: "Goal step was clear", goal: "explore_projects" },
    });
    expect(db.onboardingEvent.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "feedback_submitted", goal: "explore_projects" },
    });
  });

  it("rejects a rating outside 1 to 5 and an over-long comment", async () => {
    for (const rating of ["0", "6", "2.5", "", "five"]) {
      const result = await submitOnboardingFeedbackAction(feedbackForm({ rating }));
      expect(result).toMatchObject({ ok: false, field: "rating" });
    }
    const long = await submitOnboardingFeedbackAction(feedbackForm({ rating: "3", comment: "x".repeat(1001) }));
    expect(long).toMatchObject({ ok: false, field: "comment" });
    expect(db.onboardingFeedback.create).not.toHaveBeenCalled();
  });

  it("treats a second submit as the first one, without a second row", async () => {
    db.$transaction.mockRejectedValueOnce(uniqueViolation());
    const result = await submitOnboardingFeedbackAction(feedbackForm({ rating: "5" }));
    expect(result).toEqual({ ok: true, duplicate: true });
  });

  it("reports a failed save so the person can retry", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("db down"));
    const result = await submitOnboardingFeedbackAction(feedbackForm({ rating: "5" }));
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses anyone who isn't signed in", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    await expect(submitOnboardingFeedbackAction(feedbackForm({ rating: "5" }))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(db.onboardingFeedback.create).not.toHaveBeenCalled();
  });

  it("is rate limited per person", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    const result = await submitOnboardingFeedbackAction(feedbackForm({ rating: "5" }));
    expect(result).toEqual({ ok: false, error: "Slow down." });
    expect(db.onboardingFeedback.create).not.toHaveBeenCalled();
  });

  it("'Maybe later' snoozes the prompt without consequences", async () => {
    await expect(dismissOnboardingFeedbackAction()).resolves.toEqual({ ok: true });
    expect(db.userOnboarding.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ feedbackSnoozeCount: 1, feedbackClosedAt: null }),
    });
  });
});
