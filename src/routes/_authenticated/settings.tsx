import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app";
import { followUpConfig } from "@/config/followups";
import { riskConfig } from "@/config/risk";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { PIN_LENGTH } from "@/services/authService";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Your profile, PIN security and the active risk thresholds and follow-up rules used across the app.",
      },
      { property: "og:title", content: "Settings — Management App" },
      { property: "og:description", content: "Profile, PIN security and active app rules." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role, changePin, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await changePin(pin);
      setPin("");
      toast.success("PIN updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle={appConfig.builtBy} />

      <section className="card-surface p-5">
        <p className="font-display text-base font-semibold">Profile</p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={user?.profile?.full_name ?? "—"} />
          <Row label="User ID" value={user?.userId ?? "—"} />
          <Row label="Role" value={role ? roleLabels[role] : "No role"} />
        </dl>
        <Button
          variant="secondary"
          className="mt-4 w-full rounded-xl"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </section>

      <section className="card-surface p-5">
        <p className="font-display text-base font-semibold">Change PIN</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Exactly {PIN_LENGTH} digits. Used with your User ID to sign in.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="pin" className="text-sm">
            New PIN
          </Label>
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-xl tracking-[0.4em]"
          />
        </div>
        <Button
          className="mt-4 w-full rounded-xl"
          disabled={busy || pin.length !== PIN_LENGTH}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Update PIN"}
        </Button>
      </section>

      <section className="card-surface p-5">
        <p className="font-display text-base font-semibold">Active rules</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Defined centrally in configuration and applied everywhere in the app.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row
            label="High BP"
            value={`${riskConfig.bp.high.systolic}/${riskConfig.bp.high.diastolic} mmHg and above`}
          />
          <Row
            label="Raised BP"
            value={`${riskConfig.bp.moderate.systolic}/${riskConfig.bp.moderate.diastolic} mmHg and above`}
          />
          <Row label="High sugar" value={`${riskConfig.sugar.high} mg/dL and above`} />
          <Row label="Raised sugar" value={`${riskConfig.sugar.moderate} mg/dL and above`} />
          <Row
            label="Follow-up intervals"
            value={`High ${followUpConfig.intervalDays.high}d • Moderate ${followUpConfig.intervalDays.moderate}d • Low ${followUpConfig.intervalDays.low}d`}
          />
          <Row label="Working days" value="Monday to Saturday (Sundays excluded)" />
          <Row
            label="Working hours"
            value={`${followUpConfig.workingHours.start} – ${followUpConfig.workingHours.end}`}
          />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
