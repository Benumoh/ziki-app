/**
 * The Getting started checklist on the Ideas page (#getting-started): one
 * numbered list in place of the three separate asks a new project used to show
 * at once (the site URL panel, the "Connect an agent" card and the idea box).
 * It says what is done, what comes next and what is optional, so a person new
 * to Ziki knows where to start.
 *
 * Only facts the page already reads: whether the project has a site, whether it
 * has any ideas, and how many agents this person has.
 */

export type GettingStartedStepId = "project" | "website" | "idea" | "agent";

export type GettingStartedStep = {
  id: GettingStartedStepId;
  title: string;
  done: boolean;
  /** Optional steps can be left undone and the list still counts as finished. */
  optional: boolean;
};

export type GettingStartedInput = {
  hasSite: boolean;
  hasIdeas: boolean;
  /** This person's own agents in the organisation; null when the agent step doesn't apply to them. */
  agentCount: number | null;
};

export function gettingStartedSteps({ hasSite, hasIdeas, agentCount }: GettingStartedInput): GettingStartedStep[] {
  const steps: GettingStartedStep[] = [
    { id: "project", title: "Create your project", done: true, optional: false },
    { id: "website", title: "Tell us your website", done: hasSite, optional: false },
    { id: "idea", title: "Post your first idea", done: hasIdeas, optional: false },
  ];
  if (agentCount !== null) {
    steps.push({ id: "agent", title: "Connect an AI agent", done: agentCount > 0, optional: true });
  }
  return steps;
}

/** The step to open first: the first one not done and not skipped, or null when there is none. */
export function currentStep(steps: GettingStartedStep[], skipped: ReadonlySet<GettingStartedStepId>): GettingStartedStepId | null {
  return steps.find((step) => !step.done && !skipped.has(step.id))?.id ?? null;
}

/** Whether the checklist has anything left to ask: every required step done, and every optional one done or skipped. */
export function gettingStartedFinished(steps: GettingStartedStep[], skipped: ReadonlySet<GettingStartedStepId>): boolean {
  return steps.every((step) => step.done || (step.optional && skipped.has(step.id)));
}
