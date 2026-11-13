import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">Pick up where the sentence left off.</p>
      </div>
      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>
      )}
      <Suspense fallback={null}>
        <AuthForm mode="login" next={next} />
      </Suspense>
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </div>
  );
}
