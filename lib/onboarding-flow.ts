/**
 * #onboarding: the rules of the first-run welcome flow and the first-experience
 * feedback prompt. Pure, so the server, the client and the tests share them.
 */

export const ONBOARDING_GOALS = ["explore_projects", "contribute_issues", "work_with_agents"] as const;
export type OnboardingGoalValue = (typeof ONBOARDING_GOALS)[number];

/** Steps of the welcome flow, in order: what Ziki is, pick a goal, first action. */
export const ONBOARDING_STEPS = ["intro", "goal", "first_action"] as const;
export const LAST_ONBOARDING_STEP = ONBOARDING_STEPS.length - 1;

export const WELCOME_PATH = "/welcome";

/** "Maybe later" hides the feedback prompt this long; the second time closes it for good. */
export const FEEDBACK_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
export const FEEDBACK_MAX_SNOOZES = 2;
export const FEEDBACK_COMMENT_MAX = 1000;

export const FEEDBACK_QUESTION = "How was your first experience with Ziki?";
export const FEEDBACK_COMMENT_QUESTION = "Was anything confusing or difficult to use?";

export type GoalOption = {
  value: OnboardingGoalValue;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  actionHint: string;
};

export const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    value: "explore_projects",
    title: "Explore projects",
    description: "See what teams are building on Ziki and follow the products you care about.",
    actionLabel: "Browse projects",
    actionPath: "/discover",
    actionHint: "Discover lists public projects and the open products that accept contributors.",
  },
  {
    value: "contribute_issues",
    title: "Contribute to issues",
    description: "Pick up open issues, fix them and earn points for work that ships.",
    actionLabel: "Find work to do",
    actionPath: "/earn",
    actionHint: "Earn shows how contributing pays, then points you to projects with open issues.",
  },
  {
    value: "work_with_agents",
    title: "Work with AI agents",
    description: "Set up an AI agent that bids on issues and builds fixes for you.",
    actionLabel: "Set up an agent",
    actionPath: "/settings/agents",
    actionHint: "Agent settings walk you through creating an agent and connecting it.",
  },
];

export function isOnboardingGoal(value: unknown): value is OnboardingGoalValue {
  return typeof value === "string" && (ONBOARDING_GOALS as readonly string[]).includes(value);
}

export function goalOption(goal: OnboardingGoalValue | null | undefined): GoalOption | null {
  return GOAL_OPTIONS.find((option) => option.value === goal) ?? null;
}

/** Where finishing the flow takes someone. Without a goal, the normal app home. */
export function firstActionPath(goal: OnboardingGoalValue | null | undefined): string {
  return goalOption(goal)?.actionPath ?? "/home";
}

/** A saved step, clamped to the flow; anything unreadable starts at the beginning. */
export function clampStep(step: unknown): number {
  const n = typeof step === "number" ? step : Number(step);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, LAST_ONBOARDING_STEP);
}

/**
 * The step to resume on. The first-action step needs a goal, so a saved
 * step past the goal picker without one goes back to the picker.
 */
export function resumeStep(state: { step: number; goal: OnboardingGoalValue | null }): number {
  const step = clampStep(state.step);
  if (step >= 2 && !state.goal) return 1;
  return step;
}

export type OnboardingState = {
  completedAt: Date | null;
  skippedAt: Date | null;
  feedbackSnoozedUntil: Date | null;
  feedbackSnoozeCount: number;
  feedbackClosedAt: Date | null;
};

export function onboardingFinished(state: Pick<OnboardingState, "completedAt" | "skippedAt">): boolean {
  return Boolean(state.completedAt || state.skippedAt);
}

/**
 * Whether /home sends this person to the welcome flow. A person with no
 * onboarding row is new only if they belong to no organisation yet: someone
 * added to a team (an invite, a fixture account) already has a place to start.
 */
export function needsWelcome(state: OnboardingState | null, hasOrganisation: boolean): boolean {
  if (!state) return !hasOrganisation;
  return !onboardingFinished(state);
}

/**
 * Set for the browser session once someone finishes or skips the welcome flow.
 * Only read in always-show testing mode, so leaving the flow doesn't send
 * them straight back to it from /home.
 */
export const WELCOME_SEEN_COOKIE = "ziki-welcome-seen";

/**
 * Whether /home sends someone to the welcome flow. Normally only newcomers who
 * haven't finished it (needsWelcome). In always-show testing mode
 * (ONBOARDING_ALWAYS_SHOW=true) everyone sees it once per browser session.
 */
export function welcomeDue(
  state: OnboardingState | null,
  hasOrganisation: boolean,
  mode: { alwaysShow: boolean; seenThisSession: boolean },
): boolean {
  if (mode.alwaysShow) return !mode.seenThisSession;
  return needsWelcome(state, hasOrganisation);
}

/** Whether the first-experience feedback prompt shows right now. */
export function feedbackPromptVisible(
  state: OnboardingState | null,
  hasFeedback: boolean,
  now: Date = new Date(),
): boolean {
  if (!state || hasFeedback) return false;
  if (!onboardingFinished(state)) return false;
  if (state.feedbackClosedAt) return false;
  if (state.feedbackSnoozeCount >= FEEDBACK_MAX_SNOOZES) return false;
  return !state.feedbackSnoozedUntil || state.feedbackSnoozedUntil.getTime() <= now.getTime();
}

/** What "Maybe later" writes: a short snooze, or closed for good the last time. */
export function snoozeFeedback(state: Pick<OnboardingState, "feedbackSnoozeCount">, now: Date = new Date()) {
  const feedbackSnoozeCount = state.feedbackSnoozeCount + 1;
  return {
    feedbackSnoozeCount,
    feedbackSnoozedUntil: new Date(now.getTime() + FEEDBACK_SNOOZE_MS),
    feedbackClosedAt: feedbackSnoozeCount >= FEEDBACK_MAX_SNOOZES ? now : null,
  };
}
