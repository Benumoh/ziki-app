/**
 * #site-glance: a quick, free first look at a project's site, right after its address is saved in Getting started.
 * One read of the public homepage (lib/site-fetch.ts fetches it), then the plain checks below: no agents, no
 * ownership proof, nothing beyond what any visitor's browser receives. Each finding comes with an idea the person
 * can post in one click, so their first idea can come from their own site.
 *
 * Pure: it reads what it is given, so the rules are tested without the network.
 */

export type SitePage = {
  /** The address that answered, after redirects. */
  url: string;
  status: number;
  /** Milliseconds from the request to the last byte read. */
  elapsedMs: number;
  /** Lower-case header names. */
  headers: Record<string, string>;
  /** The start of the HTML (lib/site-fetch.ts stops reading at a size limit). */
  html: string;
  /** The full size of the HTML in bytes, when the server said or it was all read. */
  bytes: number | null;
};

export type SiteFindingId =
  | "unreachable"
  | "slow"
  | "no-title"
  | "no-description"
  | "no-viewport"
  | "no-lang"
  | "images-no-alt"
  | "heavy-page"
  | "no-hsts"
  | "no-nosniff";

export type SiteFinding = {
  id: SiteFindingId;
  /** "fix": something visitors or search engines notice; "tip": worth doing. */
  level: "fix" | "tip";
  title: string;
  detail: string;
  /** Ready to post as an idea, in the person's own words-style ("Bug: …", "Improve: …"). */
  idea: string;
};

export type SiteCheck = {
  url: string;
  checkedAt: string;
  /** The homepage loaded (a 2xx answer); when false, findings holds just "unreachable". */
  reachable: boolean;
  elapsedMs: number | null;
  findings: SiteFinding[];
};

/** Slower than this to answer is worth a look. */
export const SLOW_MS = 3000;
/** More HTML than this, before images and scripts, is heavy. */
export const HEAVY_BYTES = 500 * 1024;

const META = (name: string) => new RegExp(`<meta\\b[^>]*\\bname\\s*=\\s*["']?${name}["']?[^>]*>`, "i");
const CONTENT = /\bcontent\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;

function metaContent(html: string, name: string): string | null {
  const tag = html.match(META(name))?.[0];
  if (!tag) return null;
  const content = tag.match(CONTENT);
  return (content?.[2] ?? content?.[3] ?? content?.[4] ?? "").trim();
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** What the quick look found on a page that answered, worst first. */
export function analyseSite(page: SitePage, now: Date = new Date()): SiteCheck {
  const base = { url: page.url, checkedAt: now.toISOString(), elapsedMs: page.elapsedMs };
  if (page.status < 200 || page.status >= 300) {
    return { ...base, reachable: false, findings: [unreachable(page.url, `It answered with HTTP ${page.status}.`)] };
  }

  const html = page.html;
  const findings: SiteFinding[] = [];

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  if (!title) {
    findings.push({
      id: "no-title",
      level: "fix",
      title: "The homepage has no title",
      detail: "Browser tabs and search results show the page's title. Without one they show the bare address.",
      idea: "Improve: the homepage has no page title, so browser tabs and search results show the bare address. Give it a short title that names the product.",
    });
  }

  const viewport = metaContent(html, "viewport");
  // width=device-width or initial-scale both make a page fit a phone; either one is enough.
  if (!viewport || !/width\s*=\s*device-width|initial-scale\s*=/i.test(viewport)) {
    findings.push({
      id: "no-viewport",
      level: "fix",
      title: "It isn't set up for phones",
      detail: "There's no mobile viewport setting, so phones show a shrunken desktop page.",
      idea: "Bug: on phones the homepage shows as a tiny desktop page. Add a mobile viewport setting (width=device-width) so it fits the screen.",
    });
  }

  if (page.elapsedMs > SLOW_MS) {
    findings.push({
      id: "slow",
      level: "fix",
      title: `The homepage took ${seconds(page.elapsedMs)} to answer`,
      detail: `Visitors start leaving after about ${seconds(SLOW_MS)}. This was measured from our server, before images and scripts.`,
      idea: `Improve: the homepage took ${seconds(page.elapsedMs)} to answer before anything could show. Make it load faster.`,
    });
  }

  const description = metaContent(html, "description");
  if (!description) {
    findings.push({
      id: "no-description",
      level: "tip",
      title: "No description for search results",
      detail: "Search engines show a short description under the title. Without one they pick text from the page.",
      idea: "Improve: the homepage has no meta description, so search results show random text from the page. Add a one-sentence description of the product.",
    });
  }

  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  const withoutAlt = images.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  if (withoutAlt > 0) {
    findings.push({
      id: "images-no-alt",
      level: "tip",
      title: `${withoutAlt} ${withoutAlt === 1 ? "image has" : "images have"} no description`,
      detail: "Screen readers read an image's description aloud. Without one, people who can't see it miss what it shows.",
      idea: `Improve: ${withoutAlt} ${withoutAlt === 1 ? "image" : "images"} on the homepage ${withoutAlt === 1 ? "has" : "have"} no alt text, so screen readers can't describe ${withoutAlt === 1 ? "it" : "them"}. Add a short description to each.`,
    });
  }

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  if (!/\blang\s*=\s*["']?[a-z]/i.test(htmlTag)) {
    findings.push({
      id: "no-lang",
      level: "tip",
      title: "The page doesn't say its language",
      detail: "Screen readers and translation tools use it to read the page the right way.",
      idea: "Improve: the homepage doesn't declare its language (the lang attribute), so screen readers may read it wrongly. Set it, for example lang=\"en\".",
    });
  }

  if (page.bytes !== null && page.bytes > HEAVY_BYTES) {
    findings.push({
      id: "heavy-page",
      level: "tip",
      title: `The page itself is ${Math.round(page.bytes / 1024)} KB`,
      detail: "That's before any images or scripts. A large page is slow on phones and slow connections.",
      idea: `Improve: the homepage's HTML alone is ${Math.round(page.bytes / 1024)} KB, before images and scripts. Make it lighter so it loads faster on phones.`,
    });
  }

  if (!page.headers["strict-transport-security"]) {
    findings.push({
      id: "no-hsts",
      level: "tip",
      title: "Browsers aren't told to always use HTTPS",
      detail: "The Strict-Transport-Security header stops browsers from ever loading the site over plain HTTP.",
      idea: "Improve: the site doesn't send the Strict-Transport-Security header, so browsers aren't told to always use HTTPS. Add it.",
    });
  }

  if ((page.headers["x-content-type-options"] ?? "").toLowerCase() !== "nosniff") {
    findings.push({
      id: "no-nosniff",
      level: "tip",
      title: "A basic security header is missing",
      detail: "X-Content-Type-Options: nosniff stops browsers from guessing file types, which some attacks rely on.",
      idea: "Improve: the site doesn't send X-Content-Type-Options: nosniff. Add it so browsers don't guess file types.",
    });
  }

  return { ...base, reachable: true, findings };
}

/** The finding for a site that didn't load at all, with what went wrong. */
export function unreachable(url: string, why: string): SiteFinding {
  return {
    id: "unreachable",
    level: "fix",
    title: "We couldn't load your homepage",
    detail: `${why} Check the address is right and the site is up.`,
    idea: `Bug: the homepage at ${url} doesn't load for visitors. ${why}`,
  };
}

/** A check that couldn't reach the site at all (refused, timed out, not a public address). */
export function unreachableCheck(url: string, why: string, now: Date = new Date()): SiteCheck {
  return { url, checkedAt: now.toISOString(), reachable: false, elapsedMs: null, findings: [unreachable(url, why)] };
}

/** A stored check, if it's one this code can read (the column holds JSON written by an older version too). */
export function parseSiteCheck(value: unknown): SiteCheck | null {
  if (!value || typeof value !== "object") return null;
  const check = value as Partial<SiteCheck>;
  if (typeof check.url !== "string" || typeof check.checkedAt !== "string" || !Array.isArray(check.findings)) return null;
  return {
    url: check.url,
    checkedAt: check.checkedAt,
    reachable: Boolean(check.reachable),
    elapsedMs: typeof check.elapsedMs === "number" ? check.elapsedMs : null,
    findings: check.findings.filter(
      (finding): finding is SiteFinding =>
        Boolean(finding) && typeof finding.title === "string" && typeof finding.idea === "string" && (finding.level === "fix" || finding.level === "tip"),
    ),
  };
}
