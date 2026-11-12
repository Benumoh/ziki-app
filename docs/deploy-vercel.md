# Deploying this Ziki to Vercel (Hobby plan)

This copy deploys from `github.com/Benumoh/ziki-app`, branch `main`. Every push
to `main` becomes a production deploy; other branches get preview deploys.

The build (`vercel.json`) generates the Prisma client, applies pending
migrations with `scripts/migrate.mjs` (which uses Neon's direct connection for
migrations, and fails the build if a migration fails), then builds Next.js.

## 1. Import the repository

1. Sign in at vercel.com with GitHub.
2. **Add New → Project**, pick `Benumoh/ziki-app`, and give Vercel access to it
   when asked.
3. Leave the framework (Next.js) and build settings as detected: `vercel.json`
   supplies the build command. Don't deploy yet; add the database and
   variables first (an early deploy just fails, which is harmless).

## 2. Add a Postgres database

1. In the project: **Storage → Create Database → Neon (Postgres)**, free plan,
   a region close to you.
2. Connect it to the project for Production and Preview. This adds
   `DATABASE_URL` (pooled) and related variables.
3. Nothing else is needed for migrations: `scripts/migrate.mjs` rewrites a
   Neon `-pooler` host to the direct one. Set `DIRECT_URL` only if your
   provider isn't Neon and gives you a separate direct URL.

Attachments are stored in the database, so no file storage is needed.

## 3. Create the Google sign-in client

In production only Google sign-in is on (email/password is off by default).

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials
   → OAuth client ID** → Web application. (First time: configure the consent
   screen as External, with your app name and email.)
2. Authorized redirect URI:
   `https://<your-project>.vercel.app/api/auth/callback/google`
   (add your custom domain's version too if you add one later).
3. Copy the client ID and secret for the next step.

## 4. Environment variables

**Settings → Environment Variables**, for Production (and Preview if you use
previews). Generate each secret separately; never reuse your local `.env`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Added by the Neon integration |
| `AUTH_SECRET` | A new random value: `openssl rand -base64 32` |
| `AUTH_URL` | `https://<your-project>.vercel.app/api/auth` |
| `NEXTAUTH_URL` | Same as `AUTH_URL` |
| `GOOGLE_CLIENT_ID` | From step 3 |
| `GOOGLE_CLIENT_SECRET` | From step 3 |
| `SUPER_ADMIN_EMAIL` | The Google address you'll sign in with; it becomes super admin (and can read `/superadmin/feedback`) |
| `CRON_SECRET` | `openssl rand -base64 32`; also used by the scheduler in step 6 |
| `WEBHOOK_SECRET_KEY` | `openssl rand -hex 32`; needed once an agent subscribes a webhook. Keep it stable |
| `WEBHOOK_DISPATCH_SECRET` | `openssl rand -base64 32` |
| `CLAIM_DISPATCH_SECRET` | `openssl rand -base64 32` |

Optional:

| Variable | When |
| --- | --- |
| `GOOGLE_ALLOWED_EMAILS` / `GOOGLE_ALLOWED_DOMAINS` | To limit who can sign up. Unset, any Google account can |
| `NEXT_PUBLIC_GTM_ID` | Your own Google Tag Manager container. Unset, no analytics and no cookie banner |
| `SMTP_*` | To send notification emails |
| `ANTHROPIC_API_KEY` | For AI features such as structuring ideas |
| `TYPESENSE_*` | A hosted Typesense for faster search; unset, search uses Postgres |

Don't set `SEED_DEMO_DATA`: a production database starts empty, and the first
person to sign in with `SUPER_ADMIN_EMAIL` is the admin.

## 5. Deploy

**Deployments → Redeploy** (or push to `main`). Watch the build log for
`[db:migrate]` lines, then open `https://<your-project>.vercel.app`, sign up
with Google, and you should land on the welcome flow.

Check it's live: `https://<your-project>.vercel.app/api/health` returns the
deployed commit.

## 6. Background jobs on Hobby

Hobby allows cron jobs at most once a day, so `vercel.json` runs
`/api/internal/cron` daily as a safety net. Ziki expects it every minute (offer
expiry, stale claims, webhook delivery, level promotions, pruning). Use a free
external scheduler, for example cron-job.org:

- URL: `https://<your-project>.vercel.app/api/internal/cron`
- Method: `POST`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Schedule: every minute

A `200` response means it ran; `401` means the secret doesn't match. Upgrading
to Vercel Pro allows per-minute cron in `vercel.json` instead.

## Updating

- Your changes: commit and `git push` (to `origin`, your repo). `main` deploys.
- The original project's updates: `git fetch upstream`, then
  `git merge upstream/main`, check it locally, and push. New migrations apply on
  the next deploy.
