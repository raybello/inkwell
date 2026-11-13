import { AuthForm } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Start your book</h1>
        <p className="mt-1.5 text-sm text-muted">
          One project free, forever. No card, no trial clock.
        </p>
      </div>
      <AuthForm mode="signup" />
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
      <p className="text-center text-[11px] leading-relaxed text-muted">
        By creating an account you agree to keep writing, even on the bad days.
      </p>
    </div>
  );
}
