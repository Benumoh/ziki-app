"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  completeOnboardingAction,
  saveOnboardingProgressAction,
  skipOnboardingAction,
} from "@/app/actions/onboarding";
import { trackFunnelEvent } from "@/lib/analytics-client";
import {
  GOAL_OPTIONS,
  LAST_ONBOARDING_STEP,
  goalOption,
  WELCOME_SEEN_COOKIE,
  type OnboardingGoalValue,
} from "@/lib/onboarding-flow";

const STEP_LABELS = ["About Ziki", "Your goal", "First step"] as const;

/**
 * Marks the flow as left for this browser session (no expiry), so always-show
 * testing mode doesn't send /home straight back here. Not secret, so it's set
 * here before the action runs rather than by the action's response.
 */
function markSeenThisSession() {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${WELCOME_SEEN_COOKIE}=1; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: in testing mode /home shows the flow again; nothing else changes.
  }
}

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-electric-blue-strong px-5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-zk-bg disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-zk-border bg-zk-surface px-5 text-sm font-bold text-zk-text transition hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-zk-bg disabled:cursor-not-allowed disabled:opacity-60";
const linkButton =
  "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-zk-text2 underline-offset-4 transition hover:text-zk-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue disabled:cursor-not-allowed disabled:opacity-60";

const BENEFITS = [
  {
    title: "Ideas become shipped work",
    body: "Say what you want built or fixed in plain words. People and AI agents turn the good ideas into issues.",
  },
  {
    title: "People and agents do the work",
    body: "Contributors and their AI agents bid on issues, build the fix and open the pull request.",
  },
  {
    title: "Everyone sees the progress",
    body: "Each issue moves from idea to in progress to live, with the tests and reviews to show for it.",
  },
];

export function WelcomeFlow({
  firstName,
  initialStep,
  initialGoal,
  isNew,
}: {
  firstName: string | null;
  initialStep: number;
  initialGoal: OnboardingGoalValue | null;
  isNew: boolean;
}) {
  const [step, setStep] = useState(initialStep);
  const [goal, setGoal] = useState<OnboardingGoalValue | null>(initialGoal);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (isNew) {
      trackFunnelEvent("signup_completed");
      trackFunnelEvent("onboarding_started");
    }
  }, [isNew]);

  // Moving between steps puts focus on the new step's heading, so keyboard and
  // screen-reader users start reading at the top of what changed.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function save(nextStep: number, nextGoal: OnboardingGoalValue | null) {
    // Progress saves in the background; the flow never waits on it.
    void saveOnboardingProgressAction({ step: nextStep, goal: nextGoal })
      .then((result) => setNotice(result.ok ? null : result.error))
      .catch(() => setNotice("We couldn't save your progress. You can keep going; we'll try again on the next step."));
  }

  function goTo(nextStep: number) {
    setError(null);
    setStep(nextStep);
    save(nextStep, goal);
  }

  function next() {
    if (step === 1 && !goal) {
      setError("Choose what you'd like to do first, or skip for now.");
      return;
    }
    goTo(Math.min(step + 1, LAST_ONBOARDING_STEP));
  }

  function chooseGoal(value: OnboardingGoalValue) {
    setGoal(value);
    setError(null);
  }

  function skip() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        trackFunnelEvent("onboarding_skipped", { step: step + 1 });
        markSeenThisSession();
        const result = await skipOnboardingAction();
        if (result && !result.ok) setError(result.error);
      } catch (caught) {
        unstable_rethrow(caught);
        setError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  function finish() {
    if (pending || !goal) return;
    setError(null);
    startTransition(async () => {
      try {
        trackFunnelEvent("onboarding_completed", { goal });
        markSeenThisSession();
        trackFunnelEvent("first_action", { goal });
        const result = await completeOnboardingAction({ goal });
        if (result && !result.ok) setError(result.error);
      } catch (caught) {
        unstable_rethrow(caught);
        setError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  const chosen = goalOption(goal);

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Welcome progress" className="mb-6">
        <p className="mb-2 text-xs font-bold tracking-[0.06em] text-zk-muted uppercase">
          Step {step + 1} of {STEP_LABELS.length}
        </p>
        <div
          role="progressbar"
          aria-label="Welcome progress"
          aria-valuemin={1}
          aria-valuemax={STEP_LABELS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step]}`}
          className="h-1.5 overflow-hidden rounded-full bg-zk-chip"
        >
          <div
            className="h-full rounded-full bg-electric-blue-strong transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
          />
        </div>
        <ol className="mt-3 grid grid-cols-3 gap-2 text-xs">
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={index === step ? "font-bold text-zk-text" : index < step ? "text-zk-text2" : "text-zk-muted"}
            >
              <span className="sr-only">{index < step ? "Done: " : index === step ? "Current: " : "Next: "}</span>
              {label}
            </li>
          ))}
        </ol>
      </nav>

      <section
        aria-labelledby="welcome-heading"
        className="rounded-[20px] border border-zk-border bg-zk-surface p-5 sm:p-8"
      >
        {step === 0 ? (
          <>
            <h1
              id="welcome-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-extrabold tracking-tight text-zk-text outline-none sm:text-3xl"
            >
              {firstName ? `Welcome to Ziki, ${firstName}` : "Welcome to Ziki"}
            </h1>
            <p className="mt-2 text-base text-zk-text2">
              Your account is ready. Ziki turns what you want into shipped improvements to a product, with people and
              AI agents doing the work.
            </p>
            <ul className="mt-6 space-y-4">
              {BENEFITS.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-electric-blue-strong" />
                  <div>
                    <p className="text-sm font-bold text-zk-text">{benefit.title}</p>
                    <p className="text-sm text-zk-text2">{benefit.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-zk-muted">Two quick questions and you&apos;re in. It takes under a minute.</p>
          </>
        ) : null}

        {step === 1 ? (
          <fieldset aria-describedby={error ? "welcome-error" : undefined}>
            <legend className="contents">
              <h1
                id="welcome-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-extrabold tracking-tight text-zk-text outline-none sm:text-3xl"
              >
                What would you like to do first?
              </h1>
            </legend>
            <p className="mt-2 text-sm text-zk-text2">
              Pick one to start with. You can do all of them later.
            </p>
            <div className="mt-6 grid gap-3">
              {GOAL_OPTIONS.map((option) => {
                const checked = goal === option.value;
                return (
                  <label
                    key={option.value}
                    className={[
                      "relative flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-4 transition",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-blue",
                      checked ? "border-electric-blue-strong bg-zk-tint" : "border-zk-border hover:bg-zk-chip",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="goal"
                      value={option.value}
                      checked={checked}
                      onChange={() => chooseGoal(option.value)}
                      className="mt-1 h-4 w-4 shrink-0 accent-electric-blue-strong"
                    />
                    <span>
                      <span className="block text-sm font-bold text-zk-text">{option.title}</span>
                      <span className="mt-0.5 block text-sm text-zk-text2">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <>
            <h1
              id="welcome-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-extrabold tracking-tight text-zk-text outline-none sm:text-3xl"
            >
              {chosen ? `Your first step: ${chosen.actionLabel.toLowerCase()}` : "Your first step"}
            </h1>
            {chosen ? (
              <>
                <p className="mt-2 text-base text-zk-text2">{chosen.actionHint}</p>
                <div className="mt-6 rounded-2xl border border-zk-border bg-zk-tint p-4">
                  <p className="text-xs font-bold tracking-[0.06em] text-zk-muted uppercase">You chose</p>
                  <p className="mt-1 text-sm font-bold text-zk-text">{chosen.title}</p>
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    disabled={pending}
                    className="mt-1 text-sm font-semibold text-zk-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
                  >
                    Change
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p id="welcome-error" role="alert" className="mt-5 rounded-xl bg-zk-bad-bg p-3 text-sm text-zk-bad-fg">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-5 rounded-xl bg-zk-warn-bg p-3 text-sm text-zk-warn-fg">
            {notice}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={skip} disabled={pending} className={linkButton}>
            {step === LAST_ONBOARDING_STEP ? "Go to Ziki without this" : "Skip for now"}
          </button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step > 0 ? (
              <button type="button" onClick={() => goTo(step - 1)} disabled={pending} className={secondaryButton}>
                Back
              </button>
            ) : null}
            {step < LAST_ONBOARDING_STEP ? (
              <button type="button" onClick={next} disabled={pending} className={primaryButton}>
                {step === 0 ? "Get started" : "Continue"}
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={pending || !chosen} aria-busy={pending} className={primaryButton}>
                {pending ? "Taking you there…" : chosen?.actionLabel ?? "Continue"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
