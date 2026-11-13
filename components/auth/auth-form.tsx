"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signInAction, signUpAction, type AuthState } from "@/lib/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);

  React.useEffect(() => {
    if (state?.message) toast.success(state.message);
  }, [state?.message]);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && (
        <Field label="Pen name">
          <Input name="display_name" placeholder="Ada Marlowe" autoComplete="name" />
        </Field>
      )}
      <Field label="Email">
        <Input type="email" name="email" placeholder="you@example.com" autoComplete="email" required />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <Input
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </Field>

      {state?.error && (
        <p className="flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" loading={pending}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/auth/signup" className="text-accent hover:underline">Create an account</Link>
          </>
        ) : (
          <>
            Already writing?{" "}
            <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
