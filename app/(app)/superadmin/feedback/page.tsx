import type { OnboardingEventName } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { goalOption, isOnboardingGoal } from "@/lib/onboarding-flow";
import { LocalTime } from "@/components/local-time";

export const metadata = { title: "First-experience feedback" };

const FUNNEL: { name: OnboardingEventName; label: string }[] = [
  { name: "signup_completed", label: "Signed up" },
  { name: "onboarding_completed", label: "Finished welcome" },
  { name: "onboarding_skipped", label: "Skipped welcome" },
  { name: "first_action", label: "Took a first action" },
  { name: "feedback_submitted", label: "Sent feedback" },
];

const PAGE_SIZE = 100;

/**
 * #onboarding: what newcomers said about their first experience, for site
 * staff only. Deliberately a list and a few totals, not an analytics dashboard.
 */
export default async function FeedbackPage() {
  await requireSuperAdmin();

  const [feedback, stats, funnelCounts] = await Promise.all([
    prisma.onboardingFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        goal: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.onboardingFeedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.onboardingEvent.groupBy({ by: ["name"], _count: { _all: true } }),
  ]);

  const countFor = (name: OnboardingEventName) =>
    funnelCounts.find((row) => row.name === name)?._count._all ?? 0;
  const average = stats._avg.rating;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">First-experience feedback</h1>
        <p className="text-sm text-zk-text2">
          Ratings newcomers gave after the welcome flow, newest first. Only super admins can see this page.
        </p>
      </div>

      <section aria-labelledby="funnel-heading" className="rounded-[20px] border border-zk-border bg-zk-surface p-4 sm:p-6">
        <h2 id="funnel-heading" className="text-base font-semibold text-zk-text">
          Signup funnel
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FUNNEL.map((step) => (
            <div key={step.name} className="rounded-xl bg-zk-tint p-3">
              <dt className="text-xs text-zk-text2">{step.label}</dt>
              <dd className="mt-1 text-xl font-extrabold text-zk-text">{countFor(step.name)}</dd>
            </div>
          ))}
          <div className="rounded-xl bg-zk-tint p-3">
            <dt className="text-xs text-zk-text2">Average rating</dt>
            <dd className="mt-1 text-xl font-extrabold text-zk-text">
              {average === null ? "—" : `${average.toFixed(1)} / 5`}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="responses-heading" className="overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface">
        <h2 id="responses-heading" className="border-b border-zk-border bg-zk-tint px-4 py-3 text-base font-semibold text-zk-text sm:px-6">
          Responses ({stats._count._all})
        </h2>
        {feedback.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zk-text2 sm:px-6">No feedback yet.</p>
        ) : (
          <ul className="divide-y divide-zk-border">
            {feedback.map((row) => (
              <li key={row.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-zk-text">
                    {row.rating} / 5<span className="sr-only"> rating</span>
                  </span>
                  <span className="text-zk-text2">{row.user.name || row.user.email}</span>
                  {isOnboardingGoal(row.goal) ? (
                    <span className="rounded-full bg-zk-chip px-2 py-0.5 text-xs text-zk-text2">
                      {goalOption(row.goal)?.title}
                    </span>
                  ) : null}
                  <span className="text-xs text-zk-muted">
                    <LocalTime date={row.createdAt} />
                  </span>
                </div>
                {row.comment ? (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zk-text">{row.comment}</p>
                ) : (
                  <p className="mt-1.5 text-sm text-zk-muted">No comment.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {stats._count._all > PAGE_SIZE ? (
          <p className="border-t border-zk-border px-4 py-3 text-xs text-zk-muted sm:px-6">
            Showing the newest {PAGE_SIZE}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
