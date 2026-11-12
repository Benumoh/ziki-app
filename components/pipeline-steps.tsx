import type React from "react";
import Link from "next/link";

/**
 * The stages of the work across the top of the Issues page, on one row: Your
 * Work (only while you have any), Ideas, In Progress, Delivered and Live (only
 * once something went live), each with its count. They are tabs: the picked
 * stage is underlined (a bar under every stage read as a progress bar);
 * its statuses are listed down the left of the panel.
 *
 * On a phone they are plain tabs: equal columns, a long label on two lines with
 * its count under it, no dot, and a thin underline that is thick on the picked one.
 */
export type PipelineStage = { label: string; count: number; href: string; selected: boolean };

export function PipelineSteps({ stages, label = "Stages" }: { stages: PipelineStage[]; label?: string }) {
  return (
    // One row whatever the number of stages (Your Work and Live come and go): a column each, about 133px wide.
    <nav
      aria-label={label}
      className="grid w-full grid-cols-[repeat(var(--stages),minmax(0,1fr))] gap-x-1.5 max-sm:gap-x-0 max-sm:border-b max-sm:border-zk-border"
      style={{ "--stages": stages.length, maxWidth: stages.length * 133 } as React.CSSProperties}
    >
      {stages.map((stage) => (
        <Link
          key={stage.label}
          href={stage.href}
          aria-current={stage.selected ? "page" : undefined}
          className="group flex flex-col items-center gap-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zk-accent max-sm:min-h-11 max-sm:justify-end max-sm:gap-1.5 max-sm:pb-0 max-sm:rounded-none max-sm:px-0.5"
        >
          <span
            className={`flex items-center gap-1 whitespace-nowrap text-xs max-sm:flex-col max-sm:gap-0 max-sm:whitespace-normal max-sm:text-center max-sm:text-[13px] max-sm:leading-[1.2] ${
              stage.selected ? "font-bold text-zk-text" : "font-medium text-zk-text2 group-hover:text-zk-text"
            }`}
          >
            {stage.label}
            {/* A readable count in a small pill; the same face as the label on a phone, so the two lines read as one tab. */}
            <span
              className={`rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums sm:min-w-5 sm:text-center ${
                stage.selected ? "bg-zk-tint text-zk-accent" : "bg-zk-chip text-zk-text2"
              } max-sm:mt-0.5 max-sm:bg-transparent max-sm:px-0 max-sm:font-sans max-sm:text-[12px] ${stage.selected ? "max-sm:font-semibold max-sm:text-zk-accent" : "max-sm:font-medium max-sm:text-zk-muted"}`}
            >
              {stage.count}
            </span>
          </span>
          {/* A tab's underline (#getting-started): only the picked stage has one, so the row reads as tabs, not a progress bar. */}
          <span
            aria-hidden="true"
            className={`h-[3px] w-full rounded-full max-sm:-mb-px max-sm:rounded-none ${
              stage.selected
                ? "bg-electric-blue-strong"
                : "bg-transparent group-hover:bg-electric-blue-strong/25 max-sm:h-0"
            }`}
          />
        </Link>
      ))}
    </nav>
  );
}
