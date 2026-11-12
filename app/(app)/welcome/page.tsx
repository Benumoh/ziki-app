import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { loadOnboarding, startOnboarding } from "@/lib/onboarding-state";
import { onboardingFinished, resumeStep } from "@/lib/onboarding-flow";
import { NOINDEX } from "@/lib/seo/site";
import { WelcomeFlow } from "./welcome-flow";

export const metadata = { title: "Welcome", robots: NOINDEX };

/**
 * #onboarding: the first-run welcome flow. /home sends newcomers here; it
 * resumes at the saved step, and anyone who finished or skipped it goes on to
 * the normal app instead of seeing it again.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  const isNew = !(await loadOnboarding(user.id));
  const state = await startOnboarding(user.id);
  if (onboardingFinished(state)) redirect("/home");

  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || null;
  return (
    <WelcomeFlow
      firstName={firstName}
      initialStep={resumeStep(state)}
      initialGoal={state.goal}
      isNew={isNew}
    />
  );
}
