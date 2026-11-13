import { describe, expect, it } from "vitest";
import { analyseSite, parseSiteCheck, SLOW_MS, HEAVY_BYTES, type SitePage } from "@/lib/site-check";
import { checkSite } from "@/lib/site-fetch";

const now = new Date("2026-11-13T09:00:00Z");

const GOOD_HTML = `<!doctype html><html lang="en"><head>
<title>Acme</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Acme makes invoices simple.">
</head><body><img src="/logo.png" alt="Acme"></body></html>`;

const GOOD_HEADERS = { "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff" };

function page(overrides: Partial<SitePage> = {}): SitePage {
  return { url: "https://acme.example/", status: 200, elapsedMs: 400, headers: GOOD_HEADERS, html: GOOD_HTML, bytes: GOOD_HTML.length, ...overrides };
}

const ids = (p: SitePage) => analyseSite(p, now).findings.map((finding) => finding.id);

describe("the quick look at a site (#site-glance)", () => {
  it("finds nothing on a page that does the basics", () => {
    const check = analyseSite(page(), now);
    expect(check.reachable).toBe(true);
    expect(check.findings).toEqual([]);
  });

  it("reports a page that didn't answer with success as the only finding", () => {
    const check = analyseSite(page({ status: 503 }), now);
    expect(check.reachable).toBe(false);
    expect(check.findings.map((finding) => finding.id)).toEqual(["unreachable"]);
  });

  it("lists each missing basic, the things to fix before the tips", () => {
    const bare = "<html><head></head><body><img src=a.png><img src=b.png alt=''></body></html>";
    const found = ids(page({ html: bare, headers: {}, elapsedMs: SLOW_MS + 500, bytes: HEAVY_BYTES + 1 }));
    expect(found).toEqual(["no-title", "no-viewport", "slow", "no-description", "images-no-alt", "no-lang", "heavy-page", "no-hsts", "no-nosniff"]);
    const levels = analyseSite(page({ html: bare, headers: {} }), now).findings.map((finding) => finding.level);
    expect(levels.indexOf("tip")).toBeGreaterThan(levels.lastIndexOf("fix"));
  });

  it("accepts either way of fitting a phone screen", () => {
    expect(ids(page({ html: GOOD_HTML.replace("width=device-width, initial-scale=1", "initial-scale=1") }))).not.toContain("no-viewport");
  });

  it("gives every finding an idea to post", () => {
    const check = analyseSite(page({ html: "<html></html>", headers: {} }), now);
    for (const finding of check.findings) expect(finding.idea.length).toBeGreaterThan(20);
  });

  it("reads back a stored check, and nothing it can't read", () => {
    const stored = JSON.parse(JSON.stringify(analyseSite(page({ headers: {} }), now)));
    expect(parseSiteCheck(stored)?.findings.map((finding) => finding.id)).toEqual(["no-hsts", "no-nosniff"]);
    expect(parseSiteCheck(null)).toBeNull();
    expect(parseSiteCheck({ url: 1 })).toBeNull();
  });
});

describe("reading the site safely (#site-glance)", () => {
  // These never reach the network: the guard refuses them before any request.
  it.each(["https://127.0.0.1/", "https://10.0.0.1/", "https://192.168.1.1/", "https://169.254.169.254/latest/meta-data", "https://localhost/"])(
    "refuses %s as not a public website",
    async (url) => {
      const check = await checkSite(url, now);
      expect(check.reachable).toBe(false);
      expect(check.findings[0]?.detail).toMatch(/isn't a public website address/);
    },
  );

  it("refuses an address that isn't HTTPS", async () => {
    const check = await checkSite("http://acme.example/", now);
    expect(check.reachable).toBe(false);
    expect(check.findings[0]?.detail).toMatch(/isn't an HTTPS address/);
  });
});
