import type React from "react";
import Link from "next/link";

/**
 * The stages of the work across the top of the Issues page, on one row: Your
 * Work (only while you have any), Ideas, In Progress, Delivered and Live (only
 * once something went live), each with its count. They are tabs: the picked
 * stage is underlined (a bar under every stage read as a progress bar), and
 * each tab is as wide as its words, the first starting on the page's left edge;
 * its statuses are listed down the left of the panel.
 *
 * On a phone they are plain tabs: equal columns, a long label on two lines with
 * its count under it, no dot, and a thin underline that is thick on the picked one.
 */
export type PipelineStage = { label: string; count: number; href: string; selected: boolean };

export function PipelineSteps({ stages, label = "Stages" }: { stages: PipelineStage[]; label?: string }) {
  return (
    // Wide: tabs as wide as their words, the first one's words on the row's left edge (the -ml cancels its padding),
    // so they line up with the breadcrumb and the panel below. A phone: equal columns, one per stage.
    <nav
      aria-label={label}
      className="flex flex-wrap items-end sm:-ml-3 max-sm:grid max-sm:w-full max-sm:grid-cols-[repeat(var(--stages),minmax(0,1fr))] max-sm:border-b max-sm:border-zk-border"
      style={{ "--stages": stages.length } as React.CSSProperties}
    >
      {stages.map((stage) => (
        <Link
          key={stage.label}
          href={stage.href}
          aria-current={stage.selected ? "page" : undefined}
          className="group flex flex-col items-stretch gap-1.5 rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zk-accent max-sm:min-h-11 max-sm:items-center max-sm:justify-end max-sm:gap-1.5 max-sm:pb-0 max-sm:rounded-none max-sm:px-0.5"
        >
          <span
            className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] max-sm:flex-col max-sm:gap-0 max-sm:whitespace-normal max-sm:text-center max-sm:text-[13px] max-sm:leading-[1.2] ${
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
            className={`h-[3px] w-full rounded-full max-sm:-mb-px max-sm:self-stretch max-sm:rounded-none ${
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
