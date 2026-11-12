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
  type GoalOption,
  type OnboardingGoalValue,
} from "@/lib/onboarding-flow";
import { ZikiMark } from "@/components/ziki-mark";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  GoalIcon,
  LightbulbIcon,
  PeopleIcon,
  ShippedIcon,
  SparkleIcon,
} from "@/components/onboarding-icons";
import "@/components/onboarding-motion.css";

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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-zk-surface";
const primaryButton = `inline-flex h-11 items-center justify-center gap-2 rounded-full bg-electric-blue-strong px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(46,111,239,0.30)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${focusRing}`;
const secondaryButton = `inline-flex h-11 items-center justify-center gap-2 rounded-full border border-zk-border bg-zk-surface px-5 text-sm font-bold text-zk-text transition hover:bg-zk-chip disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const quietButton = `inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-zk-muted transition hover:text-zk-text disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const headingClass =
  "text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-zk-text outline-none sm:text-[32px]";

const BENEFITS = [
  {
    icon: <LightbulbIcon />,
    title: "Ideas become shipped work",
    body: "Say what you want built or fixed in plain words. People and AI agents turn the good ideas into issues.",
  },
  {
    icon: <PeopleIcon />,
    title: "People and agents do the work",
    body: "Contributors and their AI agents bid on issues, build the fix and open the pull request.",
  },
  {
    icon: <ShippedIcon />,
    title: "Everyone sees the progress",
    body: "Each issue moves from idea to in progress to live, with the tests and reviews to show for it.",
  },
];

/** The stepper, in the Connect-agent pattern: done steps get a check, the current one is outlined. */
function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Welcome progress">
      <p className="mb-3 text-[13px] font-semibold text-zk-muted sm:sr-only">
        Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
      </p>
      <ol className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {STEP_LABELS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={[
                "flex items-center gap-3 rounded-2xl border px-2.5 py-2 sm:px-3.5 sm:py-3",
                active ? "border-electric-blue-strong bg-zk-tint" : "border-zk-border bg-zk-surface",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
                  done
                    ? "bg-zk-ok-bg text-zk-ok-fg"
                    : active
                      ? "bg-electric-blue-strong text-white"
                      : "bg-zk-chip text-zk-muted",
                ].join(" ")}
              >
                {done ? <CheckIcon size={14} /> : index + 1}
                <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
              </span>
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                <span className="text-xs font-semibold text-zk-muted">Step {index + 1}</span>
                <span className="truncate text-sm font-bold text-zk-text">{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The deep-ocean panel beside each step, in the sign-in brand panel's style. Decorative. */
function BrandSide({ step, chosen }: { step: number; chosen: GoalOption | null }) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-deep-ocean p-8 text-white lg:flex"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(143,201,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(143,201,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-24 size-[420px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(57,120,246,0.38), rgba(57,120,246,0) 65%)" }}
      />

      <ZikiMark className="relative h-9 w-9 text-white" />

      <div className="relative flex flex-1 flex-col justify-center gap-3">
        {step === 0 ? (
          <>
            <PipelineCard tone="idea" label="Idea" title="Dark mode for the dashboard" meta="12 people agree" />
            <PipelineCard tone="progress" label="In progress" title="Agent is building the fix" meta="PR #482 · tests passing" indent />
            <PipelineCard tone="live" label="Live" title="Shipped to production" meta="Just now" />
          </>
        ) : null}
        {step === 1 ? (
          <div className="flex flex-col gap-3">
            {GOAL_OPTIONS.map((option) => {
              const on = chosen?.value === option.value;
              return (
                <div
                  key={option.value}
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
                    on ? "border-sky-tint bg-[#13213F] shadow-[0_16px_40px_rgba(0,0,0,0.35)]" : "border-[#263B63] bg-[rgba(19,33,63,0.55)] opacity-70",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-9 items-center justify-center rounded-xl",
                      on ? "bg-electric-blue-strong text-white" : "bg-[#263B63] text-sky-tint",
                    ].join(" ")}
                  >
                    <GoalIcon goal={option.value} />
                  </span>
                  <span className="text-sm font-bold">{option.title}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {step === 2 && chosen ? (
          <div className="zk-welcome-float rounded-[18px] bg-white p-5 text-[#15121F] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            <span className="text-[11px] font-bold tracking-[0.08em] text-[#5F6577] uppercase">Up next</span>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EAF2FE] text-[#1F5FD9]">
                <GoalIcon goal={chosen.value} size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold">{chosen.actionLabel}</p>
                <p className="font-mono text-xs text-[#5F6577]">ziki{chosen.actionPath}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className="relative text-sm leading-relaxed text-[#C9D6EF]">
        {step === 0
          ? "Every idea moves from a plain-words request to shipped work you can see."
          : step === 1
            ? "Start with one. Everything else is a click away later."
            : "You can come back to the rest of Ziki any time."}
      </p>
    </div>
  );
}

function PipelineCard({
  tone,
  label,
  title,
  meta,
  indent = false,
}: {
  tone: "idea" | "progress" | "live";
  label: string;
  title: string;
  meta: string;
  indent?: boolean;
}) {
  const chip =
    tone === "idea"
      ? "bg-[#F0F2F7] text-[#3E4A63]"
      : tone === "progress"
        ? "bg-[#E7F0FF] text-[#1D4FB8]"
        : "bg-[#E3F6EC] text-[#146C43]";
  return (
    <div
      className={[
        "rounded-[16px] bg-white p-4 text-[#15121F] shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
        indent ? "zk-welcome-float-late ml-8" : "zk-welcome-float mr-8",
      ].join(" ")}
    >
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chip}`}>{label}</span>
      <p className="mt-2 text-sm font-bold">{title}</p>
      <p className="text-xs text-[#5F6577]">{meta}</p>
    </div>
  );
}

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
    <div className="mx-auto w-full max-w-5xl">
      <Stepper step={step} />

      <section
        aria-labelledby="welcome-heading"
        className="mt-4 overflow-hidden rounded-[24px] border border-zk-border bg-zk-surface sm:mt-5 lg:grid lg:min-h-[540px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <BrandSide step={step} chosen={chosen} />

        <div className="flex flex-col p-5 sm:p-9">
          {/* The key resets the entrance animation on each step. */}
          <div key={step} className="zk-welcome-in flex-1">
            {step === 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zk-ok-bg px-3 py-1 text-[13px] font-bold text-zk-ok-fg">
                  <CheckIcon size={13} />
                  Your account is ready
                </span>
                <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={`mt-4 ${headingClass}`}>
                  {firstName ? (
                    <>
                      Welcome to Ziki, <span className="text-zk-accent">{firstName}</span>
                    </>
                  ) : (
                    "Welcome to Ziki"
                  )}
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-zk-text2">
                  Ziki turns what you want into shipped improvements to a product, with people and AI agents doing
                  the work.
                </p>
                <ul className="mt-6 grid gap-2.5">
                  {BENEFITS.map((benefit) => (
                    <li key={benefit.title} className="flex gap-4 rounded-2xl border border-zk-border px-4 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zk-tint text-zk-accent">
                        {benefit.icon}
                      </span>
                      <div>
                        <p className="text-[15px] font-bold text-zk-text">{benefit.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-zk-text2">{benefit.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 inline-flex items-center gap-2 text-sm text-zk-muted">
                  <SparkleIcon size={16} />
                  Two quick questions and you&apos;re in. It takes under a minute.
                </p>
              </>
            ) : null}

            {step === 1 ? (
              <fieldset aria-describedby={error ? "welcome-error" : undefined}>
                <legend className="contents">
                  <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
                    What would you like to do first?
                  </h1>
                </legend>
                <p className="mt-3 text-base text-zk-text2">Pick one to start with. You can do all of them later.</p>
                <div className="mt-7 grid gap-3">
                  {GOAL_OPTIONS.map((option) => {
                    const checked = goal === option.value;
                    return (
                      <label
                        key={option.value}
                        className={[
                          "relative flex cursor-pointer items-start gap-4 rounded-2xl p-4 transition-[border-color,box-shadow,background-color] duration-200",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-blue has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-zk-surface",
                          checked
                            ? "border-2 border-electric-blue-strong bg-zk-tint shadow-[0_8px_20px_rgba(46,111,239,0.15)]"
                            : "m-px border border-zk-border bg-zk-surface hover:border-zk-muted",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="goal"
                          value={option.value}
                          checked={checked}
                          onChange={() => chooseGoal(option.value)}
                          className="sr-only"
                        />
                        <span
                          className={[
                            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                            checked ? "bg-electric-blue-strong text-white" : "bg-zk-tint text-zk-accent",
                          ].join(" ")}
                        >
                          <GoalIcon goal={option.value} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-zk-text">{option.title}</span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-zk-text2">{option.description}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={[
                            "mt-1 size-[18px] shrink-0 rounded-full",
                            checked ? "border-[5px] border-electric-blue-strong bg-white" : "border-2 border-zk-border",
                          ].join(" ")}
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {step === 2 ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zk-tint px-3 py-1 text-[13px] font-bold text-zk-accent">
                  <SparkleIcon size={14} />
                  You&apos;re all set
                </span>
                <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={`mt-4 ${headingClass}`}>
                  {chosen ? `Your first step: ${chosen.actionLabel.toLowerCase()}` : "Your first step"}
                </h1>
                {chosen ? (
                  <>
                    <p className="mt-3 max-w-xl text-base leading-relaxed text-zk-text2">{chosen.actionHint}</p>
                    <div className="mt-7 flex items-center gap-4 rounded-2xl border-2 border-electric-blue-strong bg-zk-tint p-5 shadow-[0_8px_20px_rgba(46,111,239,0.15)]">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-electric-blue-strong text-white">
                        <GoalIcon goal={chosen.value} size={22} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-[0.06em] text-zk-muted uppercase">You chose</p>
                        <p className="text-base font-extrabold text-zk-text">{chosen.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo(1)}
                        disabled={pending}
                        className={`inline-flex h-9 items-center rounded-full border border-zk-border bg-zk-surface px-4 text-[13px] font-bold text-zk-text hover:bg-zk-chip ${focusRing}`}
                      >
                        Change
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {error ? (
              <p id="welcome-error" role="alert" className="mt-5 rounded-xl border border-zk-bad-bd bg-zk-bad-bg p-3 text-sm text-zk-bad-fg">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="mt-5 rounded-xl border border-zk-warn-bd bg-zk-warn-bg p-3 text-sm text-zk-warn-fg">
                {notice}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zk-divider pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={skip} disabled={pending} className={quietButton}>
              {step === LAST_ONBOARDING_STEP ? "Go to Ziki without this" : "Skip for now"}
            </button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              {step > 0 ? (
                <button type="button" onClick={() => goTo(step - 1)} disabled={pending} className={secondaryButton}>
                  <ArrowLeftIcon size={16} />
                  Back
                </button>
              ) : null}
              {step < LAST_ONBOARDING_STEP ? (
                <button type="button" onClick={next} disabled={pending} className={primaryButton}>
                  {step === 0 ? "Get started" : "Continue"}
                  <ArrowRightIcon size={16} />
                </button>
              ) : (
                <button type="button" onClick={finish} disabled={pending || !chosen} aria-busy={pending} className={primaryButton}>
                  {pending ? "Taking you there…" : chosen?.actionLabel ?? "Continue"}
                  {pending ? null : <ArrowRightIcon size={16} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
