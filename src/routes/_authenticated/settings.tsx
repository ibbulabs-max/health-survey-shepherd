import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings2, ShieldCheck, User, CalendarDays, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app";
import { followUpConfig } from "@/config/followups";
import { riskConfig, type RiskLevel } from "@/config/risk";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { PIN_LENGTH } from "@/services/authService";
import { fetchHolidays, createHoliday, deleteHoliday, type Holiday } from "@/services/holidayService";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Management App by Ibrahim Labs" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role, isAdmin, changePin, signOut } = useAuth();
  const { followUpIntervals, updateInterval } = useSettings();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const [intervals, setIntervals] = useState(followUpIntervals);
  
  const canManageHolidays = role === "admin" || role === "supervisor";

  const submitPin = async () => {
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

  const submitIntervals = () => {
    updateInterval("high", intervals.high);
    updateInterval("moderate", intervals.moderate);
    updateInterval("low", intervals.low);
    toast.success("Follow-up rules updated globally.");
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Settings" subtitle={appConfig.builtBy} />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <User className="size-5 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">Profile</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <Row label="Name" value={user?.profile?.full_name ?? "—"} />
              <Row label="User ID" value={user?.userId ?? "—"} />
              <Row label="Role" value={role ? roleLabels[role] : "No role"} />
            </dl>
            <Button
              variant="destructive"
              className="mt-6 w-full rounded-xl"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </section>

          <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">Change PIN</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Exactly {PIN_LENGTH} digits. Used with your User ID to sign in.
            </p>
            <div className="space-y-3">
              <Label htmlFor="pin" className="text-sm font-semibold">
                New PIN
              </Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-xl tracking-[0.4em] font-mono text-lg"
              />
            </div>
            <Button
              className="mt-4 w-full rounded-xl font-semibold"
              disabled={busy || pin.length !== PIN_LENGTH}
              onClick={() => void submitPin()}
            >
              {busy ? "Saving…" : "Update PIN"}
            </Button>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <Settings2 className="size-5 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">App Rules</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Defined centrally in configuration and applied everywhere in the app.
            </p>
            
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-foreground">Clinical Thresholds</h3>
              <dl className="space-y-2 text-sm bg-surface-muted p-3 rounded-xl border border-border/50">
                <Row label="High BP" value={`≥ ${riskConfig.bp.high.systolic}/${riskConfig.bp.high.diastolic} mmHg`} />
                <Row label="Raised BP" value={`≥ ${riskConfig.bp.moderate.systolic}/${riskConfig.bp.moderate.diastolic} mmHg`} />
                <Row label="High sugar" value={`≥ ${riskConfig.sugar.high} mg/dL`} />
                <Row label="Raised sugar" value={`≥ ${riskConfig.sugar.moderate} mg/dL`} />
              </dl>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Follow-up Intervals (Days)</span>
                {!isAdmin && <span className="text-[10px] uppercase font-bold text-muted-foreground bg-surface-muted px-2 py-0.5 rounded-md border border-border/50">Admin Only</span>}
              </h3>
              <div className="grid gap-3">
                <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <Label className="text-sm text-destructive font-semibold">High Risk</Label>
                  <Input 
                    type="number" 
                    value={intervals.high}
                    onChange={e => setIntervals({ ...intervals, high: parseInt(e.target.value) || 0 })}
                    disabled={!isAdmin}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <Label className="text-sm text-amber-600 font-semibold">Moderate Risk</Label>
                  <Input 
                    type="number" 
                    value={intervals.moderate}
                    onChange={e => setIntervals({ ...intervals, moderate: parseInt(e.target.value) || 0 })}
                    disabled={!isAdmin}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <Label className="text-sm text-green-600 font-semibold">Low Risk</Label>
                  <Input 
                    type="number" 
                    value={intervals.low}
                    onChange={e => setIntervals({ ...intervals, low: parseInt(e.target.value) || 0 })}
                    disabled={!isAdmin}
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>
              
              {isAdmin && (
                <Button variant="secondary" className="w-full mt-2 font-semibold" onClick={submitIntervals}>
                  Save Intervals
                </Button>
              )}
            </div>
            
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <Row label="Working days" value="Mon-Sat (No Sundays)" />
              <Row label="Working hours" value={`${followUpConfig.workingHours.start} – ${followUpConfig.workingHours.end}`} />
            </div>
          </section>

          {canManageHolidays && (
            <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
                <CalendarDays className="size-5 text-primary" />
                <h2 className="font-display text-base font-bold text-foreground">Holiday Management</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Define non-working days. Scheduled follow-ups falling on these days will shift forward.
              </p>
              <HolidayManager />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchHolidays().then(data => {
      setHolidays(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setAdding(true);
    try {
      const newH = await createHoliday(date, name);
      setHolidays([...holidays, newH].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
      setDate("");
      setName("");
      toast.success("Holiday added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add holiday");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHoliday(id);
      setHolidays(holidays.filter(h => h.id !== id));
      toast.success("Holiday removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove holiday");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" required value={date} onChange={e => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name (Optional)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eid al-Fitr" className="h-9" />
          </div>
        </div>
        <Button type="submit" disabled={adding || !date} className="w-full font-semibold h-9" size="sm">
          {adding ? "Adding..." : <><Plus className="size-4 mr-2" /> Add Holiday</>}
        </Button>
      </form>

      <div className="pt-2 border-t border-border/50">
        <h4 className="text-xs font-semibold mb-2">Existing Holidays</h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : holidays.length === 0 ? (
          <p className="text-xs text-muted-foreground">No holidays found.</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {holidays.map(h => (
              <li key={h.id} className="flex items-center justify-between bg-surface-muted px-3 py-2 rounded-xl text-sm border border-border/40">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{new Date(h.holiday_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {h.name && <span className="text-[10px] text-muted-foreground">{h.name}</span>}
                </div>
                <button 
                  onClick={() => handleDelete(h.id)}
                  className="p-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  aria-label="Delete holiday"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

