import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SignupForm } from "@/components/signup-form";
import { isPasswordAuthEnabled } from "@/lib/auth-mode";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { NOINDEX } from "@/lib/seo/site";
import { CheckIcon, ShieldCheckIcon } from "@/components/onboarding-icons";
import { AuthLegalNote, AuthSplitFrame } from "../login/auth-split-frame";

export const metadata = {
  title: "Create your account",
  description: "Create a free Ziki account to share ideas, contribute to issues and work with AI agents.",
  robots: NOINDEX,
};

/**
 * #onboarding: the sign-up page. Google is how accounts are made in
 * production: the first Google sign-in creates the account, so this page says
 * so instead of quietly sending people to "Sign in". Where password sign-in is
 * on (local development), it shows the email form too. Either way a new
 * account lands on /home, which starts the welcome flow.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const googleConfigured = isGoogleOAuthConfigured();
  const passwordEnabled = isPasswordAuthEnabled();

  return (
    <main>
      <AuthSplitFrame
        title="Create your Ziki account"
        panelLabel="Create an account"
        mode="signup"
        modeSwitch={{ callbackUrl }}
        description={
          googleConfigured
            ? "Continue with Google and your account is created the first time you sign in."
            : "Create an account to share ideas, contribute to issues and work with AI agents."
        }
      >
        {googleConfigured ? <GoogleSignInButton callbackUrl={callbackUrl} signup /> : null}

        {/* What a newcomer usually wants to know before they click. */}
        <ul className="flex flex-wrap justify-center gap-2 text-[13px] font-semibold text-zk-text2">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-zk-chip px-3 py-1.5">
            <span className="text-zk-ok-fg">
              <CheckIcon size={13} />
            </span>
            Free
          </li>
          {googleConfigured ? (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-zk-chip px-3 py-1.5">
              <span className="text-zk-ok-fg">
                <ShieldCheckIcon size={14} />
              </span>
              Google verifies your email
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5 rounded-full bg-zk-chip px-3 py-1.5">
            <span className="text-zk-ok-fg">
              <CheckIcon size={13} />
            </span>
            Set up in a minute
          </li>
        </ul>

        {passwordEnabled ? (
          <>
            {googleConfigured ? (
              <div className="relative py-1 text-center text-xs font-bold tracking-[0.06em] text-zk-muted uppercase">
                <span className="relative z-10 bg-zk-surface px-2">or use your email</span>
                <span className="absolute inset-x-0 top-1/2 border-t border-zk-border" />
              </div>
            ) : null}
            <SignupForm callbackUrl={callbackUrl} />
          </>
        ) : null}

        {!googleConfigured && !passwordEnabled ? (
          <div className="rounded-xl bg-zk-warn-bg p-4 text-sm text-zk-warn-fg" role="alert">
            <p className="font-medium">Sign-up isn&apos;t available right now.</p>
            <p className="mt-1">Google sign-in is not configured on this site. Please try again later.</p>
          </div>
        ) : null}

        <AuthLegalNote />
      </AuthSplitFrame>
    </main>
  );
}
