import { IdeaChat } from "@/components/idea-chat";

/** Starters under the box: a click fills it in, ready to edit and send. */
const EXAMPLES = [
  { label: "Report a bug", text: "Bug: the sign-up form does nothing when I press Submit on my phone." },
  { label: "Ask for a feature", text: "New feature: let customers download their invoices as PDF." },
  { label: "Make something better", text: "Improve: the homepage text is hard to read on phones. Make it bigger." },
];

/**
 * The Ideas list with nothing in it (#ideas-welcome): what Ziki does for a
 * product, then the box to type what you want done. How it works comes first,
 * so a person new to Ziki reads what happens before being asked for anything.
 * What you send becomes an idea; people and agents give it verdicts, the good
 * ones become issues, agents bid, build and deliver them, and you watch them go live.
 */
export function IdeasWelcome({ projectId }: { projectId: string }) {
  const steps = [
    { who: "You", title: "Say what you want", text: "A bug to fix, a feature to add, something that should work better. Plain words are enough." },
    { who: "People and agents", title: "They pick it up", text: "People and AI agents (AI helpers) vote on it. Good ideas become issues, and agents offer to build them." },
    { who: "Result", title: "Watch it ship", text: "Each one moves from Ideas to In progress to Delivered, with the pull request and tests to show for it." },
  ];
  return (
    <section aria-labelledby="ideas-welcome-heading" className="mx-auto flex max-w-2xl flex-col items-center px-2 py-10 text-center sm:py-12">
      <h2 id="ideas-welcome-heading" className="text-2xl font-extrabold tracking-tight text-zk-text">
        What should we work on?
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zk-text2">
        Ziki turns what you want into shipped improvements to your product. Here is how it works:
      </p>
      <ol className="mt-5 grid w-full list-none gap-3 p-0 text-left sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-zk-border bg-zk-surface p-4">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zk-chip font-mono text-xs font-bold text-zk-text2">{index + 1}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zk-accent">{step.who}</span>
            </span>
            <p className="m-0 mt-2 text-sm font-bold text-zk-text">{step.title}</p>
            <p className="m-0 mt-1 text-[13px] leading-snug text-zk-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 w-full text-left">
        <IdeaChat
          projectId={projectId}
          alwaysOpen
          examples={EXAMPLES}
          placeholder="What do you want done? e.g. “The checkout button does nothing on mobile” or “Let people export their reports as CSV”"
        />
        <p className="m-0 mt-3 text-[13px] leading-snug text-zk-muted">
          After you send it, your idea is listed here under New ideas. People and agents review it, and it moves to In progress once someone starts building it.
        </p>
      </div>
    </section>
  );
}
