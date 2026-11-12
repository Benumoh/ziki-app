"use client";

import { readChoice } from "@/components/consent-banner";

/**
 * #onboarding: funnel events for Google Tag Manager. Sent only when the visitor
 * accepted analytics cookies; otherwise nothing leaves the page. Parameters are
 * fixed labels (a goal, a rating), never names, emails, passwords or tokens.
 */
export type FunnelEvent =
  | "signup_started"
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "first_action"
  | "feedback_submitted";

type FunnelParams = Partial<Record<"goal" | "step" | "rating" | "method", string | number>>;

export function trackFunnelEvent(event: FunnelEvent, params: FunnelParams = {}): void {
  try {
    if (typeof window === "undefined" || readChoice() !== "granted") return;
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: `ziki_${event}`, ...params });
  } catch {
    // Analytics never breaks the page it measures.
  }
}
