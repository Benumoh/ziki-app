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
      <ol aria-label="How it works" className="mt-6 flex list-none flex-wrap items-center justify-center gap-x-2 gap-y-1 p-0 text-[13px] text-zk-muted">
        {FLOW.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zk-chip text-[11px] font-bold text-zk-text2">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
