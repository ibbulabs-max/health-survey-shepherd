import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings2, ShieldCheck, User, CalendarDays, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { appConfig } from "@/config/app";
import { followUpConfig } from "@/config/followups";
import { riskConfig, type RiskLevel } from "@/config/risk";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { PIN_LENGTH } from "@/services/authService";
import {
  fetchHolidays,
  createHoliday,
  deleteHoliday,
  type Holiday,
} from "@/services/holidayService";
import { getHealthThresholds, updateHealthThresholds } from "@/services/settingsServerFns";
import { useTheme } from "@/components/common/ThemeProvider";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Settings — Management App by Ibrahim Labs" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role, isAdmin, changePin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const [thresholds, setThresholds] = useState<any | null>(null);

  // Load DB-backed thresholds for Admin UI
  useEffect(() => {
    (async () => {
      try {
        const result = await getHealthThresholds({
          data: {
            userId: user?.userId,
            role: role ?? undefined,
          },
        });
        if (result?.success && result.settings) {
          setThresholds(result.settings);
        }
      } catch (e) {
        console.warn("Could not load health thresholds:", e);
      }
    })();
  }, [user?.userId, role]);

  const canManageHolidays = isAdmin || role === "supervisor";

  const vitals = thresholds?.vitals_config ?? {
    bloodPressure: true,
    bloodSugar: true,
    weight: true,
    height: true,
    bmi: true,
    pulse: true,
    spo2: true,
    temperature: true,
  };

  const setVital = (key: string, val: boolean) => {
    if (!thresholds) return;
    setThresholds({
      ...thresholds,
      vitals_config: { ...vitals, [key]: val },
    });
  };

  const submitPin = async () => {
    if (newPin.length !== PIN_LENGTH) {
      toast.error(`Enter a new ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePin(newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success("PIN updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update PIN.");
    } finally {
      setBusy(false);
    }
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Current PIN</Label>
                <InputOTP
                  maxLength={PIN_LENGTH}
                  value={currentPin}
                  onChange={setCurrentPin}
                  inputMode="numeric"
                  pattern="[0-9]*"
                >
                  <InputOTPGroup className="w-full justify-between gap-1.5">
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-11 rounded-xl text-base bg-background/50"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">New PIN</Label>
                <InputOTP
                  maxLength={PIN_LENGTH}
                  value={newPin}
                  onChange={setNewPin}
                  inputMode="numeric"
                  pattern="[0-9]*"
                >
                  <InputOTPGroup className="w-full justify-between gap-1.5">
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-11 rounded-xl text-base bg-background/50"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Confirm New PIN</Label>
                <InputOTP
                  maxLength={PIN_LENGTH}
                  value={confirmPin}
                  onChange={setConfirmPin}
                  inputMode="numeric"
                  pattern="[0-9]*"
                >
                  <InputOTPGroup className="w-full justify-between gap-1.5">
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-11 rounded-xl text-base bg-background/50"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button
              className="mt-6 w-full rounded-xl font-semibold"
              disabled={busy || newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
              onClick={() => void submitPin()}
            >
              {busy ? "Saving…" : "Update PIN"}
            </Button>
          </section>

          <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <Settings2 className="size-5 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">Theme Settings</h2>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Dark Mode</Label>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {canManageHolidays ? (
            <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
                <Settings2 className="size-5 text-primary" />
                <h2 className="font-display text-base font-bold text-foreground">App Rules</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Defined centrally in configuration and applied everywhere in the app.
              </p>

              <div className="space-y-4 mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Vitals & Clinical Measurements
                </h3>
                {thresholds ? (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-[1fr_120px] items-center gap-3 bg-surface-muted p-3 rounded-xl border border-border/50">
                      <Label className="text-sm font-semibold">Minimum eligible age</Label>
                      <Input
                        type="number"
                        value={thresholds.minimum_eligible_age}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            minimum_eligible_age:
                              e.target.value === "" ? "" : parseInt(e.target.value, 10),
                          })
                        }
                        className="h-9 bg-background"
                      />
                    </div>

                    {/* Blood Pressure */}
                    <div className="space-y-3 border border-border/50 p-3 rounded-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <Label className="text-sm font-bold">Blood Pressure</Label>
                        <Switch
                          checked={vitals.bloodPressure}
                          onCheckedChange={(v) => setVital("bloodPressure", v)}
                        />
                      </div>
                      {vitals.bloodPressure && (
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Systolic */}
                          <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">
                              Systolic (mmHg)
                            </Label>
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-muted-foreground">Normal (≤)</Label>
                                <Input
                                  type="number"
                                  value={thresholds.systolic_normal_max}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      systolic_normal_max:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-amber-600 font-semibold">
                                  Moderate Risk (≥)
                                </Label>
                                <Input
                                  type="number"
                                  value={thresholds.systolic_moderate_min}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      systolic_moderate_min:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-destructive font-semibold">
                                  High Risk (≥)
                                </Label>
                                <Input
                                  type="number"
                                  value={thresholds.systolic_high_min}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      systolic_high_min:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Diastolic */}
                          <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase">
                              Diastolic (mmHg)
                            </Label>
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-muted-foreground">Normal (≤)</Label>
                                <Input
                                  type="number"
                                  value={thresholds.diastolic_normal_max}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      diastolic_normal_max:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-amber-600 font-semibold">
                                  Moderate Risk (≥)
                                </Label>
                                <Input
                                  type="number"
                                  value={thresholds.diastolic_moderate_min}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      diastolic_moderate_min:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs text-destructive font-semibold">
                                  High Risk (≥)
                                </Label>
                                <Input
                                  type="number"
                                  value={thresholds.diastolic_high_min}
                                  onChange={(e) =>
                                    setThresholds({
                                      ...thresholds,
                                      diastolic_high_min:
                                        e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Blood Sugar */}
                    <div className="space-y-3 border border-border/50 p-3 rounded-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <Label className="text-sm font-bold">Blood Sugar (Random)</Label>
                        <Switch
                          checked={vitals.bloodSugar}
                          onCheckedChange={(v) => setVital("bloodSugar", v)}
                        />
                      </div>
                      {vitals.bloodSugar && (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-muted-foreground">Normal (≤)</Label>
                              <Input
                                type="number"
                                value={thresholds.sugar_normal_max}
                                onChange={(e) =>
                                  setThresholds({
                                    ...thresholds,
                                    sugar_normal_max:
                                      e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                  })
                                }
                                className="h-8 w-24 text-right"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-amber-600 font-semibold">
                                Moderate Min (≥)
                              </Label>
                              <Input
                                type="number"
                                value={thresholds.sugar_moderate_min}
                                onChange={(e) =>
                                  setThresholds({
                                    ...thresholds,
                                    sugar_moderate_min:
                                      e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                  })
                                }
                                className="h-8 w-24 text-right"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-amber-600 font-semibold">
                                Moderate Max (≤)
                              </Label>
                              <Input
                                type="number"
                                value={thresholds.sugar_moderate_max}
                                onChange={(e) =>
                                  setThresholds({
                                    ...thresholds,
                                    sugar_moderate_max:
                                      e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                  })
                                }
                                className="h-8 w-24 text-right"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-destructive font-semibold">
                                High Risk (≥)
                              </Label>
                              <Input
                                type="number"
                                value={thresholds.sugar_high_min}
                                onChange={(e) =>
                                  setThresholds({
                                    ...thresholds,
                                    sugar_high_min:
                                      e.target.value === "" ? "" : parseInt(e.target.value, 10),
                                  })
                                }
                                className="h-8 w-24 text-right"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Body Measurements */}
                    <div className="space-y-3 border border-border/50 p-3 rounded-xl">
                      <Label className="text-sm font-bold block pb-2 border-b border-border/50">
                        Body Measurements
                      </Label>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">Weight</Label>
                          <Switch
                            checked={vitals.weight}
                            onCheckedChange={(v) => setVital("weight", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">Height</Label>
                          <Switch
                            checked={vitals.height}
                            onCheckedChange={(v) => setVital("height", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">BMI</Label>
                          <Switch
                            checked={vitals.bmi}
                            onCheckedChange={(v) => setVital("bmi", v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Other Vitals */}
                    <div className="space-y-3 border border-border/50 p-3 rounded-xl">
                      <Label className="text-sm font-bold block pb-2 border-b border-border/50">
                        Other Vitals
                      </Label>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">Pulse</Label>
                          <Switch
                            checked={vitals.pulse}
                            onCheckedChange={(v) => setVital("pulse", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">SpO₂</Label>
                          <Switch
                            checked={vitals.spo2}
                            onCheckedChange={(v) => setVital("spo2", v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-foreground">Temperature</Label>
                          <Switch
                            checked={vitals.temperature}
                            onCheckedChange={(v) => setVital("temperature", v)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading settings…</p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>Follow-up Intervals (Days)</span>
                  {!isAdmin && (
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-surface-muted px-2 py-0.5 rounded-md border border-border/50">
                      Admin Only
                    </span>
                  )}
                </h3>
                {thresholds ? (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                      <Label className="text-sm text-destructive font-semibold">High Risk</Label>
                      <Input
                        type="number"
                        value={thresholds.interval_high}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            interval_high:
                              e.target.value === "" ? "" : parseInt(e.target.value, 10),
                          })
                        }
                        disabled={!isAdmin}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                      <Label className="text-sm text-amber-600 font-semibold">Moderate Risk</Label>
                      <Input
                        type="number"
                        value={thresholds.interval_moderate}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            interval_moderate:
                              e.target.value === "" ? "" : parseInt(e.target.value, 10),
                          })
                        }
                        disabled={!isAdmin}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                      <Label className="text-sm text-green-600 font-semibold">Normal</Label>
                      <Input
                        type="number"
                        value={thresholds.interval_normal}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            interval_normal:
                              e.target.value === "" ? "" : parseInt(e.target.value, 10),
                          })
                        }
                        disabled={!isAdmin}
                        className="h-9 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading intervals…</p>
                )}
              </div>

              {thresholds && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">
                    Working Configuration
                  </h3>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <Label className="text-sm">Working days</Label>
                    <span className="text-sm text-muted-foreground">Mon-Sat (No Sundays)</span>
                  </div>
                  <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                    <Label className="text-sm">Work Start Time</Label>
                    <Input
                      type="time"
                      value={thresholds.working_hours?.start ?? "09:00"}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          working_hours: { ...thresholds.working_hours, start: e.target.value },
                        })
                      }
                      disabled={!isAdmin && role !== "supervisor"}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                    <Label className="text-sm">Work End Time</Label>
                    <Input
                      type="time"
                      value={thresholds.working_hours?.end ?? "17:00"}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          working_hours: { ...thresholds.working_hours, end: e.target.value },
                        })
                      }
                      disabled={!isAdmin && role !== "supervisor"}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const anyEmpty = Object.values(thresholds).some((v) => v === "");
                      if (anyEmpty) {
                        toast.error("Please fill in all numeric fields.");
                        return;
                      }

                      // Basic client-side validation
                      if (thresholds.systolic_normal_max >= thresholds.systolic_moderate_min)
                        throw new Error("Systolic normal must be < moderate min");
                      if (thresholds.diastolic_normal_max >= thresholds.diastolic_moderate_min)
                        throw new Error("Diastolic normal must be < moderate min");
                      if (thresholds.sugar_normal_max >= thresholds.sugar_moderate_min)
                        throw new Error("Sugar normal must be < moderate min");

                      await updateHealthThresholds({
                        data: {
                          userId: user?.userId ?? "",
                          role: role ?? "admin",
                          updates: thresholds,
                        },
                      });

                      toast.success("Settings saved.");
                    } catch (err: any) {
                      const msg =
                        err?.message || (typeof err === "string" ? err : "Could not save settings");
                      toast.error(msg);
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </section>
          ) : null}

          {canManageHolidays && (
            <section className="card-surface p-5 rounded-2xl shadow-xs border border-border/70">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
                <CalendarDays className="size-5 text-primary" />
                <h2 className="font-display text-base font-bold text-foreground">
                  Holiday Management
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Define non-working days. Scheduled follow-ups falling on these days will shift
                forward.
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
    fetchHolidays().then((data) => {
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
      setHolidays(holidays.filter((h) => h.id !== id));
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
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name (Optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eid al-Fitr"
              className="h-9"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={adding || !date}
          className="w-full font-semibold h-9"
          size="sm"
        >
          {adding ? (
            "Adding..."
          ) : (
            <>
              <Plus className="size-4 mr-2" /> Add Holiday
            </>
          )}
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
            {holidays.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between bg-surface-muted px-3 py-2 rounded-xl text-sm border border-border/40"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {new Date(h.holiday_date + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
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
