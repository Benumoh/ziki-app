import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { currentOrgPathFor, firstProjectRefFor } from "@/lib/project-route";
import { ideasPath } from "@/lib/project-paths";
import { logger } from "@/lib/logger";
import { WELCOME_PATH } from "@/lib/onboarding-flow";
import { shouldShowWelcome } from "@/lib/onboarding-state";

/**
 * `/home`: where Ziki sends you when no project is named (after sign-in, from
 * a 404, from the logo with no project, and when you switch organisation). A
 * newcomer who hasn't finished or skipped the welcome flow goes there first
 * (#onboarding). Otherwise it opens the Ideas of the current organisation's
 * default project (Web when it has one), its Projects page when it has no
 * projects yet, or the organisation picker when there is no organisation.
 */
export default async function HomePage() {
  const user = await requireUser();
  let welcome = false;
  try {
    welcome = await shouldShowWelcome(user);
  } catch (error) {
    // The welcome flow is a nicety: never block someone's way into the app.
    logger.error("[home] onboarding check failed", error);
  }
  if (welcome) redirect(WELCOME_PATH);
  const slug = await firstProjectRefFor(user.id);
  if (slug) redirect(ideasPath(slug));
  redirect((await currentOrgPathFor(user.id)) ?? "/organisations");
}
