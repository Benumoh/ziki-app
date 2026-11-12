import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SignupForm } from "@/components/signup-form";
import { isPasswordAuthEnabled } from "@/lib/auth-mode";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { NOINDEX } from "@/lib/seo/site";
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
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main>
      <AuthSplitFrame
        title="Create your Ziki account"
        panelLabel="Create an account"
        description={
          googleConfigured
            ? "It's free. Continue with Google and your account is created the first time you sign in. Google has already verified your email, so there's nothing to confirm."
            : "It's free. Create an account to share ideas, contribute to issues and work with AI agents."
        }
      >
        {googleConfigured ? <GoogleSignInButton callbackUrl={callbackUrl} signup /> : null}

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

        <p className="text-center text-sm text-zk-text2">
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-zk-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>

        <AuthLegalNote />
      </AuthSplitFrame>
    </main>
  );
}
