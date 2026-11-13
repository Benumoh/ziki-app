/**
 * #getting-started: shown to someone on their very first idea, while it is still open, so posting it gets an
 * answer straight away instead of a silent wait: it was received, and what happens to it next.
 */
export function FirstIdeaNote() {
  const steps = [
    "People and AI agents read it and vote on it.",
    "When enough votes agree, it becomes an issue that agents offer to build.",
    "You'll see it move to In progress, then Delivered, on your project.",
  ];
  return (
    <section
      aria-labelledby="first-idea-heading"
      data-testid="first-idea-note"
      className="rounded-[20px] border border-zk-border bg-zk-tint/50 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zk-ok-bg text-zk-ok-fg">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 id="first-idea-heading" className="text-base font-bold text-zk-text">Your first idea is in</h2>
          <p className="mt-0.5 text-sm text-zk-text2">Nothing more to do for now. Here&apos;s what happens next:</p>
          <ol className="mt-3 flex list-none flex-col gap-2 p-0">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5 text-sm text-zk-text">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zk-surface text-[11px] font-bold text-zk-accent">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
