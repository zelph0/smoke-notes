"use client";

import { OTPField } from "@base-ui/react/otp-field";
import { ArrowLeftIcon, MailIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/modules/auth/client";
import { type SocialProvider, socialProviders } from "@/modules/auth/providers";

const OTP_LENGTH = 6;
const emailSchema = z.email("Enter a valid email address.");

type Step = { kind: "email" } | { kind: "code"; email: string };

/**
 * Passwordless sign-in: email one-time code, or a social provider from ./providers.ts.
 * New emails get an account automatically.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const otpId = useId();
  const emailId = useId();

  function sendCode(email: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (error) {
        setError(error.message ?? "Could not send a code. Try again in a moment.");
        return;
      }
      setStep({ kind: "code", email });
      setNotice(`We sent a ${OTP_LENGTH}-digit code to ${email}.`);
    });
  }

  function verify(email: string, otp: string) {
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.emailOtp({ email, otp });
      if (error) {
        setError(error.message ?? "That code didn't work. Check it and try again.");
        return;
      }
      // `next` was sanitized server-side by safeNext(), so it is a same-origin path.
      router.replace(next as Route);
      router.refresh();
    });
  }

  function social(provider: SocialProvider) {
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: new URL(next, window.location.origin).toString(),
      });
      if (error) setError(error.message ?? `${PROVIDERS[provider].label} sign-in is unavailable right now.`);
    });
  }

  if (step.kind === "code") {
    return (
      <div className="flex flex-col gap-5">
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={otpId}>Verification code</FieldLabel>
            <OTPField.Root
              id={otpId}
              length={OTP_LENGTH}
              disabled={pending}
              onValueComplete={(otp) => verify(step.email, otp)}
              aria-invalid={error ? true : undefined}
              className="flex gap-2"
            >
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <OTPField.Input
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length slots
                  key={index}
                  aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${OTP_LENGTH}`}
                  className="size-control-lg rounded-md border-ui border-input bg-transparent text-center text-lg tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
                />
              ))}
            </OTPField.Root>
            {notice && !error ? <FieldDescription role="status">{notice}</FieldDescription> : null}
            <FieldError>{error}</FieldError>
          </Field>
        </FieldGroup>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep({ kind: "email" });
              setError(null);
              setNotice(null);
            }}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Different email
          </Button>
          <Button type="button" variant="link" size="sm" disabled={pending} onClick={() => sendCode(step.email)}>
            Resend code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = emailSchema.safeParse(new FormData(event.currentTarget).get("email"));
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
            return;
          }
          sendCode(parsed.data);
        }}
      >
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email webauthn"
              inputMode="email"
              placeholder="you@example.com"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${emailId}-error` : undefined}
            />
            <FieldError id={`${emailId}-error`}>{error}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            <MailIcon data-icon="inline-start" />
            {pending ? "Sending code…" : "Email me a sign-in code"}
          </Button>
        </FieldGroup>
      </form>
      {socialProviders.length > 0 && <FieldSeparator>or</FieldSeparator>}
      {socialProviders.map((provider) => {
        const { label, Mark } = PROVIDERS[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => social(provider)}
          >
            <Mark />
            Continue with {label}
          </Button>
        );
      })}
    </div>
  );
}

const PROVIDERS: Record<SocialProvider, { label: string; Mark: () => React.ReactNode }> = {
  google: { label: "Google", Mark: GoogleMark },
  github: { label: "GitHub", Mark: GitHubMark },
  vercel: { label: "Vercel", Mark: VercelMark },
};

function GitHubMark() {
  return (
    <svg data-icon="inline-start" viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.57v-2c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function VercelMark() {
  return (
    <svg data-icon="inline-start" viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 2 23 21H1z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg data-icon="inline-start" viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.18 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
