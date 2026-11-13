"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { saveProjectLinksAction, type ProjectActionResult } from "@/app/(app)/projects/actions";
import {
  currentStep,
  gettingStartedFinished,
  gettingStartedSteps,
  type GettingStartedStepId,
} from "@/lib/getting-started";

/** Steps skipped in this browser, per project: they stay listed, marked Skipped, and can be opened again. */
const skippedKey = (slug: string) => `ziki:getting-started-skipped:${slug}`;
/** The whole list hidden in this browser, per project. */
const hiddenKey = (slug: string) => `ziki:getting-started-hidden:${slug}`;
const STORAGE_EVENT = "ziki:getting-started";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page reloads, which is fine.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

const input =
  "h-10 w-full rounded-lg border border-zk-border bg-zk-surface px-3 text-sm text-zk-text placeholder:text-zk-muted focus:border-electric-blue-strong focus:outline-none";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-zk-text px-5 text-sm font-bold text-zk-surface transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue";
const ghost =
  "inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-zk-muted hover:bg-zk-chip hover:text-zk-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue";

/**
 * Getting started (#getting-started): the Ideas page's one setup list for a new
 * project. Numbered steps with a progress bar, one open at a time, each saying
 * why it matters; the optional one says so and every step can be skipped. It
 * goes away once everything is done (or skipped), or when hidden.
 */
export function GettingStarted({
  slug,
  siteUrl,
  repoUrl,
  canEditLinks,
  hasIdeas,
  agentCount,
  agentHref,
}: {
  slug: string;
  siteUrl: string | null;
  repoUrl: string | null;
  /** Organisation owners and admins set the addresses; others see who can. */
  canEditLinks: boolean;
  hasIdeas: boolean;
  /** This person's agents here; null to leave the agent step out. */
  agentCount: number | null;
  agentHref: string;
}) {
  const [result, action, pending] = useActionState<ProjectActionResult | undefined, FormData>(saveProjectLinksAction, undefined);
  const [siteValue, setSiteValue] = useState("");
  const [submitted, setSubmitted] = useState("");
  // Unknown on the server and the first paint (nothing is drawn), so neither the list nor its hidden line flashes up.
  const visibility = useSyncExternalStore(subscribe, () => (read(hiddenKey(slug)) === "1" ? "hidden" : "shown"), () => "unknown");
  const hidden = visibility === "hidden";
  const skippedRaw = useSyncExternalStore(subscribe, () => read(skippedKey(slug)) ?? "", () => "");
  const skipped = new Set(skippedRaw.split(",").filter(Boolean) as GettingStartedStepId[]);
  const [openId, setOpenId] = useState<GettingStartedStepId | null | undefined>(undefined);

  // A site was sent and saved: the step is done before the page's refresh says so.
  const savedSite = Boolean(result && !result.error && submitted);

  const steps = gettingStartedSteps({ hasSite: Boolean(siteUrl) || savedSite, hasIdeas, agentCount });
  const current = currentStep(steps, skipped);
  // Until someone opens or closes a step themselves, the current one is open.
  const open = openId === undefined ? current : openId;

  if (visibility === "unknown" || gettingStartedFinished(steps, skipped)) return null;

  const doneCount = steps.filter((step) => step.done).length;

  // Hidden: one quiet line in its place, so the list can always be brought back.
  if (hidden) {
    return (
      // The same card as the list, folded to one row: progress on the left, Show on the right.
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-zk-border bg-zk-surface px-4 py-3 print:hidden sm:px-5">
        <div className="flex items-center gap-3 text-[13px] text-zk-text2">
          <span className="font-semibold text-zk-text">Get started</span>
          <span aria-hidden="true" className="block h-1.5 w-20 overflow-hidden rounded-full bg-zk-border">
            <span className="block h-full rounded-full bg-zk-ok-fg" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </span>
          <span className="tabular-nums">{doneCount} of {steps.length} done</span>
        </div>
        <button
          type="button"
          onClick={() => write(hiddenKey(slug), "")}
          className="inline-flex min-h-8 items-center rounded-full border border-zk-border bg-zk-surface px-3.5 text-[13px] font-semibold text-zk-text transition-colors hover:border-electric-blue-strong/40 hover:text-zk-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue"
        >
          Show checklist
        </button>
      </div>
    );
  }

  function skip(id: GettingStartedStepId) {
    write(skippedKey(slug), [...skipped, id].join(","));
    setOpenId(undefined);
  }

  function jumpToIdeaBox() {
    const box = document.getElementById("ideas-welcome-heading");
    box?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("[data-idea-chat-open] textarea")?.focus({ preventScroll: true }), 400);
  }

  return (
    // A white card of its own on the page, above the Ideas panel (not inside it), with the panel's corners;
    // the steps sit in one bordered list inside it.
    <section aria-labelledby="getting-started-heading" className="rounded-[12px] border border-zk-border bg-zk-surface p-4 print:hidden sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <h2 id="getting-started-heading" className="text-base font-extrabold tracking-tight text-zk-text">Get started</h2>
          <p className="mt-0.5 text-[13px] text-zk-text2">A few quick steps to set up your project.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] tabular-nums text-zk-text2">
            <span
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
              className="block h-1.5 w-24 overflow-hidden rounded-full bg-zk-border"
            >
              <span className="block h-full rounded-full bg-zk-ok-fg transition-[width] duration-300" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </span>
            {doneCount} of {steps.length} done
          </div>
          <button type="button" onClick={() => write(hiddenKey(slug), "1")} className={`${ghost} min-h-8 text-[13px]`}>
            Hide
          </button>
        </div>
      </div>

      <ol className="mt-4 list-none divide-y divide-zk-border overflow-hidden rounded-xl border border-zk-border bg-zk-surface p-0">
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isOpen = step.id === open && !step.done;
          const isSkipped = !step.done && skipped.has(step.id);
          const bodyId = `getting-started-${step.id}`;
          const head = (
            <>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? "bg-zk-ok-bg text-zk-ok-fg"
                    : isCurrent
                      ? "bg-electric-blue-strong text-white"
                      : "border border-zk-border text-zk-muted"
                }`}
              >
                {step.done ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                ) : (
                  index + 1
                )}
              </span>
              {/* Done steps go quiet rather than struck through: finished, not wrong. */}
              <span className={`min-w-0 flex-1 text-sm ${step.done ? "font-medium text-zk-muted" : "font-semibold text-zk-text"}`}>
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : isSkipped ? " (skipped)" : ""}</span>
              </span>
              {step.optional && !step.done ? (
                <span className="rounded-full bg-zk-chip px-2 py-0.5 text-[11.5px] font-semibold text-zk-text2">Optional</span>
              ) : null}
              <span aria-hidden="true" className="whitespace-nowrap text-[12.5px] text-zk-muted">
                {step.done ? "Done" : isSkipped ? "Skipped" : step.id === "website" ? "About 30 sec" : step.id === "idea" ? "About 1 min" : ""}
              </span>
            </>
          );
          return (
            // The current step is tinted: the one place to look.
            <li key={step.id} className={isCurrent ? "bg-zk-tint/50" : ""}>
              {step.done ? (
                <div className="flex items-center gap-3 px-4 py-2.5">{head}</div>
              ) : (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => setOpenId(isOpen ? null : step.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric-blue ${isCurrent ? "" : "hover:bg-zk-chip/50"}`}
                >
                  {head}
                </button>
              )}
              {isOpen ? (
                // Indented to the title's words (16px padding + 24px marker + 12px gap).
                <div id={bodyId} className="px-4 pb-4 sm:pl-[52px]">
                  {step.id === "website" ? (
                    canEditLinks ? (
                      <form
                        action={action}
                        onSubmit={(event) => setSubmitted(String(new FormData(event.currentTarget).get("siteUrl") ?? "").trim())}
                      >
                        <p className="mb-3 max-w-[62ch] text-sm text-zk-text2">
                          Ziki and its agents look at your live site, so they understand what you mean when you post an idea.
                        </p>
                        <input type="hidden" name="slug" value={slug} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-[13px] font-semibold text-zk-text">
                            Website address
                            <input
                              name="siteUrl"
                              type="url"
                              inputMode="url"
                              required
                              placeholder="https://yourwebsite.com"
                              value={siteValue}
                              onChange={(event) => setSiteValue(event.target.value)}
                              className={input}
                            />
                          </label>
                          <div className="flex flex-col gap-1">
                            <label className="flex flex-col gap-1 text-[13px] font-semibold text-zk-text">
                              <span>
                                Where your code lives <span className="font-normal text-zk-muted">(optional)</span>
                              </span>
                              <input name="repoUrl" type="url" inputMode="url" placeholder="https://github.com/you/your-project" defaultValue={repoUrl ?? ""} className={input} />
                            </label>
                            <details className="text-[13px] text-zk-text2">
                              <summary className="cursor-pointer font-medium text-zk-accent">What&apos;s this?</summary>
                              <p className="mt-1.5 max-w-[60ch]">
                                If a developer built your site, its code is usually kept on GitHub. Ask them for the link. Without it, agents can still
                                suggest changes but can&apos;t make them. You can add it later in Project settings.
                              </p>
                            </details>
                          </div>
                        </div>
                        {result?.error ? (
                          <p role="alert" className="mt-2 text-[13px] text-zk-bad-fg">
                            {result.fieldErrors?.siteUrl ?? result.fieldErrors?.repoUrl ?? result.error}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button type="submit" disabled={pending || !siteValue.trim()} className={primary}>
                            {pending ? "Saving…" : "Save website"}
                          </button>
                          <button type="button" onClick={() => skip(step.id)} className={ghost}>Skip for now</button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <p className="mb-3 max-w-[62ch] text-sm text-zk-text2">
                          Agents look at the project&apos;s live site to understand ideas. An organisation owner or admin adds its address.
                        </p>
                        <button type="button" onClick={() => skip(step.id)} className={ghost}>Skip</button>
                      </div>
                    )
                  ) : step.id === "idea" ? (
                    <div>
                      <p className="mb-3 max-w-[62ch] text-sm text-zk-text2">
                        Use the box below. Say what you want in plain words, or start from one of the examples.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={jumpToIdeaBox} className={primary}>Go to the idea box</button>
                        <button type="button" onClick={() => skip(step.id)} className={ghost}>Skip for now</button>
                      </div>
                    </div>
                  ) : step.id === "agent" ? (
                    <div>
                      <p className="mb-3 max-w-[62ch] text-sm text-zk-text2">
                        An agent is an AI helper. It reads ideas, turns the good ones into issues and builds them, and its work is reviewed before
                        anything is merged. Without one, people and other agents can still pick up your ideas.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={agentHref} className={primary}>Set up an agent</Link>
                        <button type="button" onClick={() => skip(step.id)} className={ghost}>Not now</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
