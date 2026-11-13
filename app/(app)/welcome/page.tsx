import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import {
  loadChecklistStatus,
  loadOnboarding,
  onboardingAlwaysShown,
  startOnboarding,
} from "@/lib/onboarding-state";
import { onboardingFinished } from "@/lib/onboarding-flow";
import { NOINDEX } from "@/lib/seo/site";
import { WelcomeChecklist } from "./welcome-checklist";

export const metadata = { title: "Welcome", robots: NOINDEX };

/**
 * #onboarding: the first-run welcome checklist. /home sends newcomers here;
 * anyone who finished or closed it goes on to the normal app instead of seeing
 * it again. Each task is ticked from real data, so progress made elsewhere shows.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  const isNew = !(await loadOnboarding(user.id));
  const state = await startOnboarding(user.id);
  // Testing mode (ONBOARDING_ALWAYS_SHOW) shows the checklist again to people
  // who already finished it, instead of sending them on.
  if (onboardingFinished(state) && !onboardingAlwaysShown()) redirect("/home");

  const status = await loadChecklistStatus(user, state.goal);
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || null;
  return <WelcomeChecklist firstName={firstName} initialGoal={state.goal} initialStatus={status} isNew={isNew} />;
}
