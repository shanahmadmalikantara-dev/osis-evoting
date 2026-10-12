"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login-action";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { AppRole } from "@/lib/roles";

const initialState: LoginState = { error: null };

export function LoginForm({ role, usernameHint }: { role: AppRole; usernameHint: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="role" value={role} />
      <label className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-widest">Nama akun</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder={usernameHint}
          className="rounded-sticker border-2 border-ink bg-surface px-4 py-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-widest">Kata sandi</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-sticker border-2 border-ink bg-surface px-4 py-3 text-base"
        />
      </label>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending} icon="↗">
        {pending ? "Memeriksa..." : "Masuk"}
      </Button>
    </form>
  );
}
