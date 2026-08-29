import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/app";
import { useAuth } from "@/hooks/useAuth";
import { PIN_LENGTH } from "@/services/authService";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (import.meta.env.DEV) {
      const qaRole = localStorage.getItem("QA_ROLE") || (import.meta.env as any).VITE_QA_ROLE;
      if (qaRole) {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Secure User ID and 6-digit PIN sign in for community health household mapping, screening and follow-up management.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, changePin, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsPinChange, setNeedsPinChange] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !user?.mustChangePin && !needsPinChange) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, navigate, user, needsPinChange]);

  const submitSignIn = async () => {
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
      const nextUser = await signIn(userId, pin);
      if (nextUser?.mustChangePin) {
        setNeedsPinChange(true);
      } else {
        await navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      setPin("");
      toast.error(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const submitChangePin = async () => {
    if (newPin.length !== PIN_LENGTH) {
      toast.error(`Enter a new ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match.");
      return;
    }
    if (newPin === pin) {
      toast.error("New PIN must be different from the temporary PIN.");
      return;
    }
    setBusy(true);
    try {
      await changePin(newPin);
      toast.success("PIN changed successfully.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change PIN.");
    } finally {
      setBusy(false);
    }
  };

  if (needsPinChange) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-12">
        <div className="absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)]" aria-hidden />
        
        <div className="relative w-full max-w-sm z-10">
          <div className="mb-8 text-center space-y-2">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldCheck className="size-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">Update Your PIN</h1>
            <p className="text-sm text-muted-foreground px-4">
              For security, you must change your temporary PIN before accessing the system.
            </p>
          </div>

          <div className="card-surface space-y-6 p-6 rounded-3xl border border-white/20 dark:border-white/10 shadow-xl backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">New 6-digit PIN</label>
              <InputOTP maxLength={PIN_LENGTH} value={newPin} onChange={setNewPin} inputMode="numeric" pattern="[0-9]*">
                <InputOTPGroup className="w-full justify-between gap-1.5">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 rounded-xl text-base bg-background/50" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Confirm New PIN</label>
              <InputOTP maxLength={PIN_LENGTH} value={confirmPin} onChange={setConfirmPin} onComplete={() => void submitChangePin()} inputMode="numeric" pattern="[0-9]*">
                <InputOTPGroup className="w-full justify-between gap-1.5">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 rounded-xl text-base bg-background/50" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="h-12 w-full rounded-2xl text-base font-semibold shadow-md active:scale-[0.98] transition-transform"
              disabled={busy || newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
              onClick={() => void submitChangePin()}
            >
              {busy ? "Updating..." : "Secure My Account"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-12">
      <div className="absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)]" aria-hidden />
      
      <div className="relative w-full max-w-sm z-10">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-xl font-bold text-primary-foreground shadow-xl shadow-primary/20">
            IL
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">{appConfig.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground font-medium">{appConfig.builtBy}</p>
        </div>

        <div className="card-surface space-y-6 p-6 rounded-3xl border border-white/20 dark:border-white/10 shadow-xl backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70">
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-semibold text-foreground px-1">
              User ID
            </label>
            <Input
              id="userId"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="e.g. admin"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-12 rounded-2xl bg-background/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground px-1">6-digit PIN</label>
            <InputOTP
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={setPin}
              onComplete={() => void submitSignIn()}
              inputMode="numeric"
              pattern="[0-9]*"
            >
              <InputOTPGroup className="w-full justify-between gap-1.5">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 rounded-xl text-base bg-background/50" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            disabled={busy}
            onClick={() => void submitSignIn()}
          >
            {busy ? "Signing in…" : (
              <>Sign in <ArrowRight className="size-4" /></>
            )}
          </Button>
        </div>
        
        <p className="mt-6 text-center text-xs font-medium text-muted-foreground/80 max-w-[250px] mx-auto">
          Access is strictly role-based. Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
