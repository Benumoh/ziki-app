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
};

export const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    value: "explore_projects",
    title: "Explore projects",
    description: "See what teams are building on Ziki and follow the products you care about.",
  },
  {
    value: "contribute_issues",
    title: "Contribute to issues",
    description: "Pick up open issues, fix them and earn points for work that ships.",
  },
  {
    value: "work_with_agents",
    title: "Work with AI agents",
    description: "Set up an AI agent that bids on issues and builds fixes for you.",
  },
];

/**
 * The welcome checklist (#onboarding): what a newcomer can do first, in any
 * order. "account" and "goal" are done on the page itself; the rest link out,
 * and each is ticked from real data (a membership, a project, an agent).
 */
export const CHECKLIST_TASKS = ["account", "goal", "organisation", "project", "agent"] as const;
export type ChecklistTask = (typeof CHECKLIST_TASKS)[number];

/** The tasks that leave the page, and where each of their two buttons goes. */
export const CHECKLIST_LINK_TASKS = ["organisation", "project", "agent"] as const;
export type ChecklistLinkTask = (typeof CHECKLIST_LINK_TASKS)[number];
export type ChecklistLink = "primary" | "secondary";

export const CHECKLIST_LINKS: Record<ChecklistLinkTask, Record<ChecklistLink, { label: string; path: string }>> = {
  organisation: {
    primary: { label: "Create organisation", path: "/organisations?open=create" },
    secondary: { label: "Join with an invite", path: "/organisations?open=join" },
  },
  project: {
    primary: { label: "Browse projects", path: "/discover" },
    secondary: { label: "How contributing pays", path: "/earn" },
  },
  agent: {
    // The same one-button page Getting started (#getting-started) and the next-step card send people to.
    primary: { label: "Set up an agent", path: "/settings/connect" },
    secondary: { label: "What agents do", path: "/for-agents" },
  },
};

export function checklistLinkPath(task: ChecklistLinkTask, link: ChecklistLink): string {
  return CHECKLIST_LINKS[task][link].path;
}

/** Which goal each task serves, so the chosen goal's task is the one suggested next. */
const GOAL_TASK: Record<OnboardingGoalValue, ChecklistLinkTask> = {
  explore_projects: "project",
  contribute_issues: "project",
  work_with_agents: "agent",
};

export function recommendedTask(goal: OnboardingGoalValue | null | undefined): ChecklistLinkTask | null {
  return goal ? GOAL_TASK[goal] : null;
}

export type ChecklistStatus = Record<ChecklistTask, boolean>;

export function checklistProgress(status: ChecklistStatus): { done: number; total: number } {
  return { done: CHECKLIST_TASKS.filter((task) => status[task]).length, total: CHECKLIST_TASKS.length };
}

/**
 * The task the checklist opens on: the goal picker until there's a goal, then
 * the goal's own task if it's still to do, else the first one left.
 */
export function openTaskFor(status: ChecklistStatus, goal: OnboardingGoalValue | null | undefined): ChecklistTask | null {
  if (!status.goal) return "goal";
  const suggested = recommendedTask(goal);
  if (suggested && !status[suggested]) return suggested;
  return CHECKLIST_TASKS.find((task) => !status[task]) ?? null;
}

export function isOnboardingGoal(value: unknown): value is OnboardingGoalValue {
  return typeof value === "string" && (ONBOARDING_GOALS as readonly string[]).includes(value);
}

export function goalOption(goal: OnboardingGoalValue | null | undefined): GoalOption | null {
  return GOAL_OPTIONS.find((option) => option.value === goal) ?? null;
}

/** A saved step, clamped to the flow; anything unreadable starts at the beginning. */
export function clampStep(step: unknown): number {
  const n = typeof step === "number" ? step : Number(step);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, LAST_ONBOARDING_STEP);
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

/**
 * How long after the welcome flow the feedback prompt waits for someone who hasn't posted an idea: long enough to
 * have tried something, so the question isn't asked before there is an experience to rate.
 */
export const FEEDBACK_WAIT_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the first-experience feedback prompt shows right now. It asks once there is something to rate: right
 * after the person's first idea, or a day after the welcome flow for someone who hasn't posted one.
 */
export function feedbackPromptVisible(
  state: OnboardingState | null,
  hasFeedback: boolean,
  now: Date = new Date(),
  { postedIdea = false }: { postedIdea?: boolean } = {},
): boolean {
  if (!state || hasFeedback) return false;
  if (!onboardingFinished(state)) return false;
  const finishedAt = state.completedAt ?? state.skippedAt;
  if (!postedIdea && finishedAt && now.getTime() - finishedAt.getTime() < FEEDBACK_WAIT_MS) return false;
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
