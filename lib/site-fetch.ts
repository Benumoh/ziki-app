import "server-only";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { checkSsrf, isPublicAddress } from "@/lib/webhooks/ssrf";
import { analyseSite, unreachableCheck, type SiteCheck, type SitePage } from "@/lib/site-check";

/**
 * #site-glance: reads a project's public homepage for the quick look (lib/site-check.ts).
 *
 * The address comes from a person, so it gets the same guard as webhooks (lib/webhooks/ssrf.ts): HTTPS only, no
 * credentials or local names, and every address the name resolves to must be public. The request is pinned to the
 * address that was checked (so DNS can't change between the check and the request), keeps the real host for TLS,
 * and each redirect is checked again. It reads at most READ_LIMIT bytes and gives up after TIMEOUT_MS.
 */

export const TIMEOUT_MS = 8_000;
const READ_LIMIT = 600 * 1024;
const MAX_REDIRECTS = 3;

type Got = { status: number; headers: Record<string, string>; html: string; bytes: number | null; location: string | null };

function get(url: URL, address: string, deadline: number): Promise<Got> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error("timeout"));
    const req = httpsRequest(
      url,
      {
        method: "GET",
        agent: false,
        lookup: (_host, options, callback) => {
          const family = isIP(address);
          if (options.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        },
        headers: {
          "User-Agent": "ZikiSiteGlance/1.0 (+https://ziki.dev)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          // Read the bytes as sent: no decompression here, and sizes stay honest.
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
        }
        if (status >= 300 && status < 400) {
          response.destroy();
          resolve({ status, headers, html: "", bytes: null, location: headers.location ?? null });
          return;
        }
        const chunks: Buffer[] = [];
        let read = 0;
        let cut = false;
        response.on("data", (chunk: Buffer) => {
          if (cut) return;
          chunks.push(chunk);
          read += chunk.length;
          if (read >= READ_LIMIT) {
            cut = true;
            response.destroy();
            finish();
          }
        });
        const finish = () => {
          clearTimeout(timer);
          const declared = Number(headers["content-length"]);
          resolve({
            status,
            headers,
            html: Buffer.concat(chunks).subarray(0, READ_LIMIT).toString("utf8"),
            bytes: Number.isFinite(declared) && declared > 0 ? declared : cut ? null : read,
            location: null,
          });
        };
        response.on("end", finish);
        response.on("error", (error) => (cut ? undefined : reject(error)));
      },
    );
    const timer = setTimeout(() => {
      req.destroy(new Error("timeout"));
    }, remaining);
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.end();
  });
}

/** Why an address was refused, in words for the person (the guard's own reasons are written for webhooks). */
function refused(reason: string): string {
  if (/HTTPS/.test(reason)) return "It isn't an HTTPS address.";
  // "resolves to a blocked address" is a private or special address, not a missing one: check it first.
  if (/blocked|local hostnames|Credentials/.test(reason)) return "It isn't a public website address.";
  if (/resolve|No addresses/.test(reason)) return "Its name didn't lead to any server.";
  return "It isn't a public website address.";
}

/** The quick look at `siteUrl`: fetched safely, then analysed. Never throws; a failure is itself the result. */
export async function checkSite(siteUrl: string, now: Date = new Date()): Promise<SiteCheck> {
  const started = Date.now();
  const deadline = started + TIMEOUT_MS;
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return unreachableCheck(siteUrl, "That isn't a valid web address.", now);
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const guard = await checkSsrf(url.toString());
    if (!guard.ok) return unreachableCheck(url.toString(), refused(guard.reason), now);
    // The guard resolved the name; the request goes to that address and no other.
    if (!isPublicAddress(guard.address)) return unreachableCheck(url.toString(), "It isn't a public website address.", now);
    let got: Got;
    try {
      got = await get(url, guard.address, deadline);
    } catch (error) {
      const timedOut = error instanceof Error && /timeout/i.test(error.message);
      return unreachableCheck(
        url.toString(),
        timedOut ? `It didn't answer within ${TIMEOUT_MS / 1000} seconds.` : "The connection to it failed.",
        now,
      );
    }
    if (got.location) {
      try {
        url = new URL(got.location, url);
      } catch {
        return unreachableCheck(url.toString(), "It redirected to an address that isn't valid.", now);
      }
      continue;
    }
    const page: SitePage = {
      url: url.toString(),
      status: got.status,
      elapsedMs: Date.now() - started,
      headers: got.headers,
      html: got.html,
      bytes: got.bytes,
    };
    return analyseSite(page, now);
  }
  return unreachableCheck(siteUrl, "It redirected too many times.", now);
}
