import { describe, expect, it } from "vitest";
import { currentStep, gettingStartedFinished, gettingStartedSteps, type GettingStartedStepId } from "@/lib/getting-started";

const none = new Set<GettingStartedStepId>();

describe("gettingStartedSteps", () => {
  it("lists the project as done and the rest from what the project has", () => {
    const steps = gettingStartedSteps({ hasSite: false, hasIdeas: false, agentCount: 0 });
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["project", true],
      ["website", false],
      ["idea", false],
      ["agent", false],
    ]);
  });

  it("marks only the agent step optional", () => {
    const steps = gettingStartedSteps({ hasSite: false, hasIdeas: false, agentCount: 0 });
    expect(steps.filter((step) => step.optional).map((step) => step.id)).toEqual(["agent"]);
  });

  it("leaves the agent step out when it doesn't apply", () => {
    const steps = gettingStartedSteps({ hasSite: true, hasIdeas: true, agentCount: null });
    expect(steps.map((step) => step.id)).toEqual(["project", "website", "idea"]);
  });
});

describe("currentStep", () => {
  it("is the first step not done", () => {
    expect(currentStep(gettingStartedSteps({ hasSite: false, hasIdeas: false, agentCount: 0 }), none)).toBe("website");
    expect(currentStep(gettingStartedSteps({ hasSite: true, hasIdeas: false, agentCount: 0 }), none)).toBe("idea");
  });

  it("passes over skipped steps", () => {
    const steps = gettingStartedSteps({ hasSite: false, hasIdeas: false, agentCount: 0 });
    expect(currentStep(steps, new Set<GettingStartedStepId>(["website"]))).toBe("idea");
  });

  it("is null when nothing is left", () => {
    expect(currentStep(gettingStartedSteps({ hasSite: true, hasIdeas: true, agentCount: 1 }), none)).toBeNull();
  });
});

describe("gettingStartedFinished", () => {
  it("is finished once every step is done", () => {
    expect(gettingStartedFinished(gettingStartedSteps({ hasSite: true, hasIdeas: true, agentCount: 2 }), none)).toBe(true);
  });

  it("is finished with the optional agent step skipped", () => {
    const steps = gettingStartedSteps({ hasSite: true, hasIdeas: true, agentCount: 0 });
    expect(gettingStartedFinished(steps, none)).toBe(false);
    expect(gettingStartedFinished(steps, new Set<GettingStartedStepId>(["agent"]))).toBe(true);
  });

  it("is not finished while a required step is only skipped", () => {
    const steps = gettingStartedSteps({ hasSite: false, hasIdeas: true, agentCount: null });
    expect(gettingStartedFinished(steps, new Set<GettingStartedStepId>(["website"]))).toBe(false);
  });
});
