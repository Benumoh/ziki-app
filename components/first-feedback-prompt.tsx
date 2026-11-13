"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  dismissOnboardingFeedbackAction,
  submitOnboardingFeedbackAction,
} from "@/app/actions/onboarding";
import { trackFunnelEvent } from "@/lib/analytics-client";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_COMMENT_QUESTION, FEEDBACK_QUESTION } from "@/lib/onboarding-flow";
import { CheckIcon, CloseIcon } from "@/components/onboarding-icons";
import "@/components/onboarding-motion.css";

const RATING_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 focus-visible:ring-offset-zk-surface";

type Step = "rate" | "comment" | "sent";

/**
 * #onboarding: "How was your first experience with Ziki?" A small card in a
 * corner, never a dialog: the page stays usable around it and nothing waits on
 * an answer. Two short steps in one card: pick a rating, then an optional
 * comment. × ("Maybe later") hides it for a few days; a second time, for good.
 */
export function FirstFeedbackPrompt() {
  const id = useId();
  const [step, setStep] = useState<Step>("rate");
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new heading when the card changes step, so keyboard and
  // screen reader users follow along; not on first show, which would steal focus.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (!open) return null;

  const headingId = `${id}-heading`;
  const commentId = `${id}-comment`;

  function later() {
    setOpen(false);
    // Hiding never depends on the server; saving the snooze is best effort.
    void dismissOnboardingFeedbackAction().catch(() => undefined);
  }

  function choose(value: number) {
    setRating(value);
    setError(null);
    setStep("comment");
  }

  function send(withComment: boolean) {
    if (pending || rating === null) return;
    setError(null);
    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("comment", withComment ? comment : "");
    startTransition(async () => {
      try {
        const result = await submitOnboardingFeedbackAction(formData);
        if (result.ok) {
          if (!result.duplicate) trackFunnelEvent("feedback_submitted", { rating });
          setStep("sent");
        } else if (result.field === "rating") {
          setError(result.error);
          setStep("rate");
        } else {
          setError(result.error);
        }
      } catch {
        setError("We couldn't send your feedback. Your answers are still here; try again.");
      }
    });
  }

  const closeButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={label}
      className={`-mt-1.5 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-zk-text2 hover:bg-zk-chip hover:text-zk-text disabled:opacity-60 ${focusRing}`}
    >
      <CloseIcon size={18} />
    </button>
  );

  const errorBox = error ? (
    <p role="alert" className="mt-3 rounded-xl border border-zk-bad-bd bg-zk-bad-bg px-3 py-2 text-sm text-zk-bad-fg">
      {error}
    </p>
  ) : null;

  return (
    <section
      aria-labelledby={headingId}
      className="zk-welcome-in fixed right-3 bottom-36 left-3 z-40 rounded-2xl border border-zk-border bg-zk-surface p-5 text-zk-text shadow-[0_12px_40px_rgba(11,23,51,0.14)] sm:right-auto sm:left-4 sm:w-[400px] lg:bottom-4"
    >
      {step === "sent" ? (
        <div role="status" className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zk-ok-bg text-zk-ok-fg">
            <CheckIcon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 ref={headingRef} tabIndex={-1} id={headingId} className="text-base font-semibold outline-none">
              Thanks for your feedback
            </h2>
            <p className="mt-0.5 text-sm text-zk-text2">
              It goes straight to the team building Ziki. We read every answer and use it to decide what to fix next.
            </p>
          </div>
          {closeButton("Close", () => setOpen(false))}
        </div>
      ) : step === "rate" ? (
        <div key="rate" className="zk-welcome-in">
          <div className="flex items-start gap-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              id={headingId}
              className="min-w-0 flex-1 text-base leading-snug font-semibold outline-none"
            >
              {FEEDBACK_QUESTION}
            </h2>
            {closeButton("Maybe later", later)}
          </div>

          <fieldset className="mt-4">
            <legend className="sr-only">Rate your first experience from 1 (very poor) to 5 (great)</legend>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => {
                const checked = rating === value;
                return (
                  <label
                    key={value}
                    className={[
                      "flex h-12 cursor-pointer items-center justify-center rounded-xl border text-base font-semibold transition-[background-color,border-color,color] duration-150",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-blue has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-zk-surface",
                      checked
                        ? "border-electric-blue-strong bg-electric-blue-strong text-white"
                        : "border-zk-border bg-zk-surface text-zk-text hover:border-electric-blue hover:bg-zk-tint",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={checked}
                      onChange={() => choose(value)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">{value}</span>
                    <span className="sr-only">
                      {value}: {RATING_LABELS[value]}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 flex justify-between text-xs text-zk-text2" aria-hidden="true">
              <span>Very poor</span>
              <span>Great</span>
            </p>
          </fieldset>
          {errorBox}
        </div>
      ) : (
        <form
          key="comment"
          className="zk-welcome-in"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send(true);
          }}
        >
          <div className="flex items-start gap-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              id={headingId}
              className="min-w-0 flex-1 text-base leading-snug font-semibold outline-none"
            >
              {FEEDBACK_COMMENT_QUESTION}
            </h2>
            {closeButton("Maybe later", later)}
          </div>

          <p className="mt-1 text-xs text-zk-text2">
            You rated {rating}: {rating ? RATING_LABELS[rating] : ""}.{" "}
            <button
              type="button"
              onClick={() => setStep("rate")}
              disabled={pending}
              className={`rounded font-semibold text-zk-accent hover:underline ${focusRing}`}
            >
              Change
            </button>
          </p>

          <label htmlFor={commentId} className="sr-only">
            {FEEDBACK_COMMENT_QUESTION} (optional)
          </label>
          <textarea
            id={commentId}
            name="comment"
            rows={4}
            maxLength={FEEDBACK_COMMENT_MAX}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Optional. Tell us in a sentence or two"
            className="mt-3 w-full resize-y rounded-xl border border-zk-border bg-zk-surface px-3.5 py-3 text-sm text-zk-text placeholder:text-zk-muted focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/20 focus:outline-none"
          />

          {errorBox}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className={`inline-flex h-11 items-center rounded-xl bg-electric-blue-strong px-5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              {pending ? "Sending…" : "Send feedback"}
            </button>
            <button
              type="button"
              onClick={() => send(false)}
              disabled={pending}
              className={`inline-flex h-11 items-center rounded-xl bg-zk-chip px-5 text-sm font-semibold text-zk-text hover:brightness-95 disabled:opacity-60 ${focusRing}`}
            >
              Skip
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
