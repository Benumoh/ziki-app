"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  saveOnboardingProgressAction,
  skipOnboardingAction,
  startChecklistTaskAction,
} from "@/app/actions/onboarding";
import { trackFunnelEvent } from "@/lib/analytics-client";
import {
  CHECKLIST_LINKS,
  CHECKLIST_TASKS,
  GOAL_OPTIONS,
  WELCOME_SEEN_COOKIE,
  checklistProgress,
  openTaskFor,
  recommendedTask,
  type ChecklistLink,
  type ChecklistLinkTask,
  type ChecklistStatus,
  type ChecklistTask,
  type OnboardingGoalValue,
} from "@/lib/onboarding-flow";
import { CheckIcon, ChevronDownIcon, CloseIcon, GoalIcon } from "@/components/onboarding-icons";
import "@/components/onboarding-motion.css";

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
const primaryButton = `inline-flex h-11 items-center justify-center rounded-xl bg-electric-blue-strong px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const secondaryButton = `inline-flex h-11 items-center justify-center rounded-xl bg-zk-chip px-5 text-sm font-semibold text-zk-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

const TASK_COPY: Record<ChecklistTask, { title: string; body: string; doneBody?: string }> = {
  account: {
    title: "Create your account",
    body: "You're signed in and your account is ready.",
  },
  goal: {
    title: "Tell us what you're here for",
    body: "We'll suggest where to start. You can do everything else too.",
  },
  organisation: {
    title: "Join or create an organisation",
    body: "An organisation is your team or company; its people, projects and issues stay inside it. Create one, or join with an invite link from your team.",
    doneBody: "You're in an organisation. You can make or join another any time.",
  },
  project: {
    title: "Find a project to work on",
    body: "Discover lists public projects and open products that accept contributors. Join one to see its issues and start earning points.",
    doneBody: "You've joined a project. Discover has more when you want them.",
  },
  agent: {
    title: "Set up an AI agent",
    body: "An agent bids on issues and builds fixes for you. Setup walks you through creating one and connecting it.",
    doneBody: "Your agent is set up. Agent settings has its keys and activity.",
  },
};

function StatusDot({ done }: { done: boolean }) {
  return done ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white">
      <CheckIcon size={14} />
    </span>
  ) : (
    <span className="size-6 shrink-0 rounded-full border-2 border-zk-border" />
  );
}

/** One row of the checklist: a header that opens and closes, and its panel. */
function TaskRow({
  task,
  done,
  open,
  suggested,
  onToggle,
  children,
}: {
  task: ChecklistTask;
  done: boolean;
  open: boolean;
  suggested: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  const copy = TASK_COPY[task];
  return (
    <li className="rounded-2xl border border-zk-border bg-zk-surface">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left ${focusRing}`}
        >
          <StatusDot done={done} />
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-zk-text">
            {copy.title}
            <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
          </span>
          {suggested && !done ? (
            <span className="rounded-full bg-zk-tint px-2.5 py-0.5 text-xs font-semibold text-zk-accent">Suggested</span>
          ) : null}
          <span className={`text-zk-text2 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
            <ChevronDownIcon size={18} />
          </span>
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="zk-welcome-in px-5 pb-5">
          <p className="text-sm leading-relaxed text-zk-text2">{done && copy.doneBody ? copy.doneBody : copy.body}</p>
          {children}
        </div>
      ) : null}
    </li>
  );
}

/**
 * #onboarding: the welcome page as a getting-started checklist. Five things to
 * do first, ticked from real data; one is open at a time. Picking a goal is
 * saved here; the other buttons lead into the app, and taking one finishes the
 * welcome flow. × leaves for the normal app.
 */
export function WelcomeChecklist({
  firstName,
  initialGoal,
  initialStatus,
  isNew,
}: {
  firstName: string | null;
  initialGoal: OnboardingGoalValue | null;
  initialStatus: ChecklistStatus;
  isNew: boolean;
}) {
  const [goal, setGoal] = useState<OnboardingGoalValue | null>(initialGoal);
  const [choice, setChoice] = useState<OnboardingGoalValue | null>(initialGoal);
  const [status, setStatus] = useState<ChecklistStatus>(initialStatus);
  const [openTask, setOpenTask] = useState<ChecklistTask | null>(() => openTaskFor(initialStatus, initialGoal));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingGoal, startSavingGoal] = useTransition();
  const goalName = useId();

  useEffect(() => {
    if (isNew) {
      trackFunnelEvent("signup_completed");
      trackFunnelEvent("onboarding_started");
    }
  }, [isNew]);

  const { done, total } = checklistProgress(status);
  const suggested = recommendedTask(goal);

  function toggle(task: ChecklistTask) {
    setError(null);
    setOpenTask((current) => (current === task ? null : task));
  }

  function saveGoal() {
    if (!choice) {
      setError("Choose one to continue.");
      return;
    }
    setError(null);
    startSavingGoal(async () => {
      try {
        const result = await saveOnboardingProgressAction({ step: 1, goal: choice });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const next = { ...status, goal: true };
        setGoal(choice);
        setStatus(next);
        setOpenTask(openTaskFor(next, choice));
      } catch {
        setError("We couldn't save that. Check your connection and try again.");
      }
    });
  }

  function go(task: ChecklistLinkTask, link: ChecklistLink) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        trackFunnelEvent("onboarding_completed", goal ? { goal } : {});
        trackFunnelEvent("first_action", goal ? { goal } : {});
        markSeenThisSession();
        const result = await startChecklistTaskAction({ task, link });
        if (result && !result.ok) setError(result.error);
      } catch (caught) {
        unstable_rethrow(caught);
        setError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  function close() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        trackFunnelEvent("onboarding_skipped", { step: done });
        markSeenThisSession();
        const result = await skipOnboardingAction();
        if (result && !result.ok) setError(result.error);
      } catch (caught) {
        unstable_rethrow(caught);
        setError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  const errorBox = error ? (
    <p role="alert" className="mt-3 rounded-xl border border-zk-bad-bd bg-zk-bad-bg px-3 py-2 text-sm text-zk-bad-fg">
      {error}
    </p>
  ) : null;

  function linkButtons(task: ChecklistLinkTask) {
    const links = CHECKLIST_LINKS[task];
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => go(task, "primary")} disabled={pending} className={primaryButton}>
          {links.primary.label}
        </button>
        <button type="button" onClick={() => go(task, "secondary")} disabled={pending} className={secondaryButton}>
          {links.secondary.label}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px] py-2 sm:py-6">
      <section
        aria-labelledby="welcome-heading"
        aria-busy={pending}
        className="zk-welcome-in rounded-[20px] border border-zk-border bg-zk-surface p-5 shadow-[0_12px_40px_rgba(11,23,51,0.10)] sm:p-7"
      >
        <div className="flex items-start gap-3">
          <h1 id="welcome-heading" className="min-w-0 flex-1 text-xl font-bold tracking-[-0.01em] text-zk-text sm:text-[22px]">
            {firstName ? `Welcome to Ziki, ${firstName}` : "Welcome to Ziki"}
          </h1>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            aria-label="Close the checklist and go to Ziki"
            title="Close the checklist and go to Ziki"
            className={`-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-zk-text2 hover:bg-zk-chip hover:text-zk-text disabled:opacity-60 ${focusRing}`}
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zk-text2">
          On Ziki, people and AI agents turn ideas into shipped work. These steps get you to your first piece of it; do
          them in any order.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-semibold text-zk-text tabular-nums">
            {done}/{total}
          </span>
          <div
            role="progressbar"
            aria-label="Checklist progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={`${done} of ${total} done`}
            className="h-2 flex-1 overflow-hidden rounded-full bg-zk-tint"
          >
            <div
              className="h-full rounded-full bg-electric-blue-strong transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {CHECKLIST_TASKS.map((task) => (
            <TaskRow
              key={task}
              task={task}
              done={status[task]}
              open={openTask === task}
              suggested={suggested === task}
              onToggle={() => toggle(task)}
            >
              {task === "goal" ? (
                <fieldset className="mt-4">
                  <legend className="sr-only">What would you like to do first?</legend>
                  <div className="space-y-2">
                    {GOAL_OPTIONS.map((option) => {
                      const checked = choice === option.value;
                      return (
                        <label
                          key={option.value}
                          className={[
                            "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-blue has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-zk-surface",
                            checked ? "border-electric-blue bg-zk-tint" : "border-zk-border hover:border-electric-blue",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name={goalName}
                            value={option.value}
                            checked={checked}
                            onChange={() => {
                              setChoice(option.value);
                              setError(null);
                            }}
                            className="sr-only"
                          />
                          <span className={`mt-0.5 ${checked ? "text-zk-accent" : "text-zk-text2"}`}>
                            <GoalIcon goal={option.value} size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-zk-text">{option.title}</span>
                            <span className="mt-0.5 block text-[13px] text-zk-text2">{option.description}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-electric-blue" : "border-zk-border"}`}
                          >
                            {checked ? <span className="size-2 rounded-full bg-electric-blue" /> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {errorBox}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveGoal}
                      disabled={savingGoal || pending}
                      aria-busy={savingGoal}
                      className={primaryButton}
                    >
                      {savingGoal ? "Saving…" : status.goal ? "Update" : "Save"}
                    </button>
                  </div>
                </fieldset>
              ) : task === "account" ? null : (
                <>
                  {linkButtons(task)}
                  {openTask === task ? errorBox : null}
                </>
              )}
            </TaskRow>
          ))}
        </ul>
        {/* An error with no task open (closing the checklist failed) still needs a place. */}
        {openTask === null || openTask === "account" ? errorBox : null}
      </section>
    </div>
  );
}
