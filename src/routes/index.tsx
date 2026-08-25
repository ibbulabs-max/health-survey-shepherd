import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/app";
import { useAuth } from "@/hooks/useAuth";
import { PIN_LENGTH } from "@/services/authService";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Secure User ID and 6-digit PIN sign in for community health household mapping, screening and follow-up management.",
      },
      { property: "og:title", content: "Management App — Ibrahim Labs" },
      {
        property: "og:description",
        content:
          "Household mapping, member screening, vitals analytics and follow-up management for community health teams.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) void navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  const submit = async () => {
    if (!userId.trim()) {
      toast.error("Enter your User ID.");
      return;
    }
    if (pin.length !== PIN_LENGTH) {
      toast.error(`Enter your ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    setBusy(true);
    try {
      await signIn(userId, pin);
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      setPin("");
      toast.error(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-primary-soft"
        style={{ maskImage: "linear-gradient(to bottom, black, transparent)" }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-float">
            IL
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold">{appConfig.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{appConfig.builtBy}</p>
        </div>

        <div className="card-surface space-y-5 p-6">
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-medium text-foreground">
              User ID
            </label>
            <Input
              id="userId"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="e.g. admin"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">6-digit PIN</label>
            <InputOTP
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={setPin}
              onComplete={() => void submit()}
              inputMode="numeric"
              pattern="[0-9]*"
            >
              <InputOTPGroup className="w-full justify-between">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 rounded-xl text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="h-11 w-full rounded-xl text-sm font-semibold"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Access is role based. Contact your administrator if your PIN doesn't work.
          </p>
        </div>
      </div>
    </div>
  );
}
