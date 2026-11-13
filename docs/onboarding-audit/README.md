# Signup, onboarding and first-experience feedback

Site evaluation and change record for the new-user experience: signup, the
welcome flow, the first-experience feedback prompt and the funnel events.
Screenshots are in this folder; "before" images are from `main` at `f514cc6b`.

## How it was evaluated

- Read the signup, sign-in, landing and app-shell code.
- Walked the real flow in a browser as a brand-new account, on desktop
  (1024–1280 px) and phone (375 px) widths, then again after the changes.
- Checked keyboard focus, accessible names, contrast of the main buttons and
  touch-target sizes on the pages a newcomer sees.
- Production signs people in with Google only; locally the same flow was tested
  with the email form, which ends on the same `/home` redirect.

## Findings

| # | Severity | Finding | Where | Status |
| --- | --- | --- | --- | --- |
| 1 | Critical | Email signup crashed with "Something went wrong" (`headers.get is not a function` in the auth rate limiter). The same helper broke forgot-password and reset-password. | `app/actions/auth.ts` | Fixed |
| 2 | High | `/signup` silently redirected to "Sign in to Ziki". Nothing told a newcomer that signing in with Google also creates the account. | `app/(auth)/signup/page.tsx`, login page | Fixed |
| 3 | High | No welcome: a new account landed straight on "Join or create an organisation", with no explanation of what Ziki is or what to do first. | `/home` → `/organisations` | Fixed |
| 4 | High | The primary "Sign in" and "Create account" buttons were white on light blue (#95b5f9), about 2:1 contrast (WCAG AA needs 4.5:1). The shared Button's `bg-teal-700` won over the blue the forms asked for. | `components/login-form.tsx`, `components/signup-form.tsx` | Fixed (now #2e6fef, about 4.6:1) |
| 5 | Medium | On phones and narrow windows the sign-in and sign-up forms sat below a full screen of marketing; keyboard focus also reached the brand panel first. | `app/(auth)/login/auth-split-frame.tsx` | Fixed (form first, same desktop look) |
| 6 | Medium | No way to hear how a newcomer's first experience went, and no measure of where people drop off between signup and a first action. | — | Fixed (feedback prompt and funnel events) |
| 7 | Medium | The floating "Lost? Ask Support" bubble covers the bottom of the sign-up form's "Create account" button on a 375 px phone. | `components/support-guide` | Fixed: on the sign-in and sign-up pages the closed bubble shows only from 640 px up; those pages have Help in their footer |
| 8 | Low | "Terms" and "Privacy Policy" under the auth forms look like links but aren't, and there are no such pages. | `AuthLegalNote` | Fixed: plain text, not link-styled (`a219da63`). Real policy pages are still to come |
| 9 | Low | The theme toggle on the auth pages overlaps the card's top-right corner on a 375 px phone. | `AuthSplitFrame` | Fixed: phones get room above the card for the toggle (`a219da63`) |
| 10 | Info | The Next.js dev badge overlaps "Your App" in the bottom bar. Development only; not shown in production. | — | No action |

Reproduction for the fixed items: sign out, open `/signup` (or `/login` on a
375 px wide window), and create an account. Before the fix, #1 shows "Something
went wrong" on submit; #4 is visible on the submit button in dark mode.

## What changed

**Signup.** `/signup` is a real "Create your Ziki account" page: Google where it
is configured (its first sign-in creates the account, and Google has verified
the email), plus the email form where password sign-in is on. The sign-in page
says that continuing with Google creates an account and links to sign-up. Errors
show next to the field and keep what was typed; the submit button is disabled
while a request is in flight.

**Welcome checklist (`/welcome`).** (It replaced the first three-step flow.) Five
things to do first, in any order, with a progress bar: the account (already
done), "What would you like to do first?" (explore projects, contribute to
issues, or work with AI agents), join or create an organisation, find a
project to work on, and set up an AI agent. Each is ticked from real data (a
membership, a project, an agent), and the chosen goal's task is marked
Suggested. Taking any task's button finishes the welcome; × skips it. `/home`
sends someone here only while they haven't finished or skipped it, and only if
they're new: accounts that existed before this change were marked as finished
by the migration, and someone who joined through an invite already belongs to
an organisation and goes straight to it.

**Into the first project (#getting-started).** Creating an organisation comes
with its Web project and opens its Ideas page, where Get started carries on:
the project (done), the site's address, a first idea, and an AI agent
(optional). The agent step has the same name and the same page
(`/settings/connect`) in both lists, and an agent set up from either one ticks
both. Posting a first idea answers at once: the idea page says "Your first idea
is in" and what happens to it next.

**Your site at a glance (#site-glance).** Once the site's address is saved,
Get started takes one quick, free look at its public homepage: whether it
loads, how fast it answers, a page title and search description, phone
layout, the page language, images without descriptions, the page's size, and
two basic security headers. Findings show worst first, each with "Post as
idea", which puts a written-up idea in the idea box. The address gets the
webhooks' guard (HTTPS only, public addresses only, re-checked on every
redirect), the read stops at 8 seconds or 600 KB, a project may be checked 5
times every 10 minutes, and the last result is kept on the project
(`siteCheck`, cleared when the address changes).

**Feedback prompt.** Once there is something to rate (right after the
person's first idea, or a day after the welcome for someone who hasn't posted
one), a small card asks "How was your
first experience with Ziki?" with a 1–5 rating; the optional "Was anything
confusing or difficult to use?" box and Submit appear once a rating is chosen,
so the card stays small. It is never a dialog and nothing waits on it. "Maybe
later" hides it for three days, and a second time for good. One response per
person (a unique key, so a double click or a second tab adds nothing), rate
limited, stored with the chosen goal, and readable only by super admins at
`/superadmin/feedback`, which also shows the signup funnel counts.

**Funnel events.** Stored in `OnboardingEvent` with only the user id, the event
name and the goal: signup completed, onboarding started, completed, skipped,
first action, website saved and first idea posted (each once per person, and
only for people who signed up since the funnel began), feedback submitted and
feedback dismissed. The same events
(plus "signup started" on the sign-up page) go to Google Tag Manager only when
the visitor accepted analytics cookies. No names, emails, passwords or tokens
are sent anywhere.

## Data model

Migration `20270125000000_onboarding_feedback` adds `UserOnboarding`,
`OnboardingFeedback` and `OnboardingEvent`, with database checks on the rating
(1–5), the comment (at most 1,000 characters) and the step (0–2), and backfills
every existing user as finished. All three cascade when a user is deleted.
Migration `20270126000000_onboarding_project_events` adds the `website_saved`
and `first_idea_posted` event names.

## Tests

`tests/platform/onboarding.test.ts` (21 cases): who sees the welcome flow (new,
invited, resumed, finished, skipped), where each goal leads, resume after an
unsaved goal, the feedback prompt's visibility and snoozes, completing once,
a double-click finish, an invalid goal, skipping once, saving progress, a failed
save, storing feedback for the signed-in user only, invalid ratings and comments,
a duplicate submit, a failed submit, a signed-out request and the rate limit.

`e2e/signup-flow.spec.ts` walks the whole first journey in a real browser at
1280 px and 375 px: sign up, the welcome checklist, a goal, an organisation,
Get started on the Ideas page (no feedback question yet), a first idea from a
starter, then "Your first idea is in" and the feedback question, with no page
scrolling sideways.

Checked by hand in the browser: signup with a wrong confirmation, signup,
each welcome step, leaving midway and resuming, a double-click finish (one set
of events), the feedback prompt, a double-click submit (one row), the thank-you
message, "Maybe later", skipping, an existing user signing in (no welcome, no
prompt), the super-admin page and a non-admin being refused it, and the auth
pages at phone and desktop widths.

## Screenshots

| Before | After |
| --- | --- |
| `before-signup-redirects-to-signin.jpg` | `after-signup-desktop.jpg`, `after-signup-mobile-form-first.jpg` |
| `before-signup-crash-and-low-contrast-button.jpg` | `after-signup-inline-error-keeps-input.jpg` |
| `before-first-landing-desktop.jpg`, `before-first-landing-mobile.jpg` | `after-welcome-step-1.jpg`, `after-welcome-step-2-goal.jpg`, `after-welcome-step-3-resumed.jpg` |
| — | `after-feedback-prompt-compact.jpg`, `after-feedback-thanks.jpg`, `after-superadmin-feedback.jpg` |
