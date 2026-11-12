import { IssuesList } from "../issues/_list/issues-list";
import { queryOf } from "../issues/_list/route-page";
import { requireProject } from "@/lib/project-route";

type Props = {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `/<slug>/ideas`: new ideas, the project's landing list (#project-urls). A search here looks through them. */
export default async function IdeasPage({ params, searchParams }: Props) {
  const { org, project } = await params;
  const query = await searchParams;
  // Feature plans is in the project actions beside the stage tabs (ProjectIconLinks), not a row of its own.
  await requireProject(org, project);
  return <IssuesList org={org} slug={project} status="ideas" returnTo={`/${org}/${project}/ideas${queryOf(query)}`} searchParams={Promise.resolve(query)} />;
}
