import { IdeaChat } from "@/components/idea-chat";

/** Starters under the box: a click fills it in, ready to edit and send. */
const EXAMPLES = [
  { label: "Report a bug", text: "Bug: the sign-up form does nothing when I press Submit on my phone." },
  { label: "Ask for a feature", text: "New feature: let customers download their invoices as PDF." },
  { label: "Make something better", text: "Improve: the homepage text is hard to read on phones. Make it bigger." },
];

/** How an idea travels, in one line under the box. */
const FLOW = ["You post an idea", "People and AI agents build it", "It ships"];

/**
 * The Ideas list with nothing in it (#ideas-welcome): one line on what Ziki
 * does, the box to type what you want done, and how an idea travels in one
 * short line. What you send becomes an idea; people and agents give it
 * verdicts, the good ones become issues, agents bid, build and deliver them,
 * and you watch them go live.
 */
export function IdeasWelcome({ projectId }: { projectId: string }) {
  return (
    <section aria-labelledby="ideas-welcome-heading" className="mx-auto flex max-w-2xl flex-col items-center px-2 py-8 text-center sm:py-10">
      <h2 id="ideas-welcome-heading" className="text-2xl font-extrabold tracking-tight text-zk-text">
        What should we work on?
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zk-text2">
        Describe a bug, a feature or anything to improve, in plain words.
      </p>
      <div className="mt-6 w-full text-left">
        <IdeaChat
          projectId={projectId}
          alwaysOpen
          examples={EXAMPLES}
          placeholder="e.g. “The checkout button does nothing on mobile”"
        />
      </div>
      {/* A section of its own, set apart from the box and its starters by space and a hairline. */}
      <div className="mt-10 w-full border-t border-zk-border pt-6">
        <h3 id="ideas-how-heading" className="text-[11px] font-bold uppercase tracking-[0.08em] text-zk-muted">How it works</h3>
        <ol aria-labelledby="ideas-how-heading" className="mt-3 flex list-none flex-wrap items-center justify-center gap-x-3 gap-y-2 p-0 text-[13px] text-zk-text2">
          {FLOW.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              {index > 0 ? <span aria-hidden="true" className="text-zk-muted">→</span> : null}
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zk-tint text-[11px] font-bold text-zk-accent">{index + 1}</span>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
