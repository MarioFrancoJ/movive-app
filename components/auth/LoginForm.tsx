"use client";

/**
 * LoginForm — Supabase Auth
 *
 * Authenticates via:
 * - supabase.auth.signInWithPassword() for email/password
 * - supabase.auth.signInWithOAuth() for Google
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  /** URL to redirect after successful login. Defaults to /dashboard. */
  redirectTo?: string;
  /** Error message from URL params (e.g., auth callback failure). */
  callbackError?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginForm({ redirectTo = "/dashboard", callbackError }: LoginFormProps) {
  const router = useRouter();
  const { dict } = useDictionary();
  const t = dict.auth.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError(t.validationEmailRequired);
      return;
    }
    if (!password) {
      setError(t.validationPasswordRequired);
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? t.errorInvalidCredentials
          : authError.message
      );
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            {t.title}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            {t.subtitle}
          </p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3" role="alert">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* Callback error */}
          {callbackError && (
            <div className="rounded-lg bg-amber-50 px-4 py-3" role="alert">
              <p className="text-sm font-medium text-amber-700">
                {t.callbackError}
              </p>
            </div>
          )}

          {/* Email */}
          <Input
            id="email"
            type="email"
            label={t.fieldEmail}
            placeholder={t.fieldEmailPlaceholder}
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
          />

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              {t.fieldPassword}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t.fieldPasswordPlaceholder}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
            />
            {/* Forgot password — moved below the field, small top margin */}
            <Link
              href="/forgot-password"
              className="mt-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              {t.forgotPassword}
            </Link>
          </div>

          {/* Sign in button */}
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? t.signingIn : t.signInButton}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs text-zinc-400">{t.dividerOr}</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* Google OAuth */}
          <Button type="button" variant="outline" fullWidth onClick={handleGoogleSignIn}>
            <GoogleIcon />
            {t.continueWithGoogle}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          {t.noAccount}{" "}
          <Link
            href="/register"
            className="font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
          >
            {t.createAccountLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
