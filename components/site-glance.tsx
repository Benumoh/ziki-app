"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { checkProjectSiteAction } from "@/app/(app)/projects/actions";
import type { SiteCheck } from "@/lib/site-check";
import { LocalTime } from "@/components/local-time";
import { fillIdeaBox } from "@/lib/idea-fill";

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const ghost =
  "inline-flex min-h-8 items-center rounded-full px-3 text-[13px] font-semibold text-zk-accent hover:bg-zk-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue disabled:opacity-50";

/**
 * #site-glance: "Your site at a glance" in Getting started. One quick look at the saved site's homepage (no
 * agents, nothing paid), its findings worst first, and "Post as idea" on each, which puts a written-up idea in the
 * idea box. It runs by itself right after the site is saved here; "Check again" runs it on request.
 */
export function SiteGlance({
  projectId,
  siteUrl,
  initialCheck,
  autoRun,
}: {
  projectId: string;
  siteUrl: string;
  initialCheck: SiteCheck | null;
  /** Just saved in this visit: look straight away instead of waiting for a click. */
  autoRun: boolean;
}) {
  const [check, setCheck] = useState<SiteCheck | null>(initialCheck);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ran = useRef(false);

  function run() {
    startTransition(async () => {
      try {
        const result = await checkProjectSiteAction(projectId);
        setError(result.ok ? null : result.error);
        if (result.ok) setCheck(result.check);
      } catch {
        setError("We couldn't check your site just now. Try again in a moment.");
      }
    });
  }

  useEffect(() => {
    if (autoRun && !ran.current && !initialCheck) {
      ran.current = true;
      run();
    }
    // Once per mount: run() only reads its arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const findings = check?.findings ?? [];
  const fixes = findings.filter((finding) => finding.level === "fix").length;

  return (
    <section aria-labelledby="site-glance-heading" aria-busy={pending} className="mt-4 rounded-xl border border-zk-border bg-zk-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h3 id="site-glance-heading" className="text-sm font-bold text-zk-text">
            Your site at a glance
          </h3>
          <p className="text-[13px] text-zk-text2">
            {pending
              ? `Looking at ${shortUrl(siteUrl)}… this takes a few seconds.`
              : !check
                ? `A free, quick look at ${shortUrl(siteUrl)}: speed, phones, search and basic security.`
                : !check.reachable
                  ? `We couldn't load ${shortUrl(check.url)}.`
                  : findings.length === 0
                    ? `${shortUrl(check.url)} passed our quick look.`
                    : `${findings.length} ${findings.length === 1 ? "thing" : "things"} to look at on ${shortUrl(check.url)}${fixes ? `, ${fixes} worth fixing first` : ""}.`}
          </p>
        </div>
        <button type="button" onClick={run} disabled={pending} className={ghost}>
          {pending ? (
            <span aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          {pending ? "Checking" : check ? "Check again" : "Check my site"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="border-t border-zk-border px-4 py-2.5 text-[13px] text-zk-bad-fg">
          {error}
        </p>
      ) : null}

      {check && !pending && findings.length > 0 ? (
        <ul className="m-0 list-none divide-y divide-zk-border border-t border-zk-border p-0">
          {findings.map((finding) => (
            <li key={finding.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  finding.level === "fix" ? "bg-zk-warn-bg text-zk-warn-fg" : "bg-zk-chip text-zk-text2"
                }`}
              >
                {finding.level === "fix" ? "Fix" : "Tip"}
              </span>
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-sm font-semibold text-zk-text">{finding.title}</p>
                <p className="mt-0.5 text-[13px] text-zk-text2">{finding.detail}</p>
              </div>
              <button type="button" onClick={() => fillIdeaBox(finding.idea)} className={`${ghost} shrink-0`}>
                Post as idea
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {check && !pending ? (
        <p className="border-t border-zk-border px-4 py-2 text-[12px] text-zk-muted">
          One read of your public homepage, as any visitor&apos;s browser sees it. Checked <LocalTime date={check.checkedAt} />.
        </p>
      ) : null}
    </section>
  );
}
