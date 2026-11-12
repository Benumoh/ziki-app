"use client";

import { useId, useState, useTransition } from "react";
import {
  dismissOnboardingFeedbackAction,
  submitOnboardingFeedbackAction,
} from "@/app/actions/onboarding";
import { trackFunnelEvent } from "@/lib/analytics-client";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_COMMENT_QUESTION, FEEDBACK_QUESTION } from "@/lib/onboarding-flow";

const RATING_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/**
 * #onboarding: "How was your first experience with Ziki?" A small card in a
 * corner, never a dialog: the page stays usable around it and nothing waits on
 * an answer. "Maybe later" hides it for a few days; a second time, for good.
 */
export function FirstFeedbackPrompt() {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ratingInvalid, setRatingInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const headingId = `${id}-heading`;
  const errorId = `${id}-error`;

  function later() {
    setOpen(false);
    // Hiding never depends on the server; saving the snooze is best effort.
    void dismissOnboardingFeedbackAction().catch(() => undefined);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (rating === null) {
      setRatingInvalid(true);
      setError("Choose a rating from 1 to 5.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("comment", comment);
    startTransition(async () => {
      try {
        const result = await submitOnboardingFeedbackAction(formData);
        if (result.ok) {
          if (!result.duplicate) trackFunnelEvent("feedback_submitted", { rating });
          setSent(true);
        } else {
          setRatingInvalid(result.field === "rating");
          setError(result.error);
        }
      } catch {
        setError("We couldn't send your feedback. Your answers are still here; try again.");
      }
    });
  }

  return (
    <section
      aria-labelledby={headingId}
      className="fixed bottom-24 left-3 right-3 z-40 rounded-2xl border border-zk-border bg-zk-surface p-4 text-zk-text shadow-[0_20px_50px_rgba(11,23,51,0.18)] sm:left-4 sm:right-auto sm:w-[360px] lg:bottom-4"
    >
      {sent ? (
        <div role="status">
          <h2 id={headingId} className="text-sm font-bold">
            Thanks for your feedback
          </h2>
          <p className="mt-1 text-sm text-zk-text2">It goes straight to the team building Ziki.</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-zk-border px-4 text-sm font-bold hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h2 id={headingId} className="text-sm font-bold">
            {FEEDBACK_QUESTION}
          </h2>
          <fieldset className="mt-3" aria-describedby={ratingInvalid && error ? errorId : undefined}>
            <legend className="sr-only">Rate your first experience from 1 (very poor) to 5 (great)</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => {
                const checked = rating === value;
                return (
                  <label
                    key={value}
                    className={[
                      "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-sm font-bold transition",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-blue",
                      checked
                        ? "border-electric-blue-strong bg-electric-blue-strong text-white"
                        : "border-zk-border text-zk-text hover:bg-zk-chip",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={checked}
                      onChange={() => {
                        setRating(value);
                        setRatingInvalid(false);
                        setError(null);
                      }}
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
            <p className="mt-1.5 flex justify-between text-xs text-zk-muted" aria-hidden="true">
              <span>Very poor</span>
              <span>Great</span>
            </p>
          </fieldset>

          {/* The comment and Submit appear once there's a rating, so the card stays small until then. */}
          {rating !== null ? (
            <>
              <label htmlFor={`${id}-comment`} className="mt-3 block text-sm text-zk-text2">
                {FEEDBACK_COMMENT_QUESTION} <span className="text-zk-muted">(optional)</span>
              </label>
              <textarea
                id={`${id}-comment`}
                name="comment"
                rows={2}
                maxLength={FEEDBACK_COMMENT_MAX}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-1.5 w-full resize-y rounded-xl border border-zk-border bg-zk-surface px-3 py-2 text-sm text-zk-text placeholder:text-zk-muted focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue/20"
              />
            </>
          ) : null}

          {error ? (
            <p id={errorId} role="alert" className="mt-2 text-sm text-zk-bad-fg">
              {error}
            </p>
          ) : null}

          <div className={`flex items-center justify-end gap-2 ${rating !== null ? "mt-3" : "-mt-1"}`}>
            <button
              type="button"
              onClick={later}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-zk-text2 hover:text-zk-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue disabled:opacity-60"
            >
              Maybe later
            </button>
            {rating !== null ? (
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex min-h-11 items-center rounded-full bg-electric-blue-strong px-4 text-sm font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Sending…" : "Submit feedback"}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
