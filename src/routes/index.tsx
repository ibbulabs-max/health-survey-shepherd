import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  Activity,
  MapPin,
  BarChart3,
  HeartPulse,
  Users,
  CalendarCheck,
  CloudOff,
  User,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/components/common/ThemeProvider";
import { PIN_LENGTH } from "@/services/authService";
import { cn } from "@/lib/utils";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { MobileInstallExperience } from "@/components/public/MobileInstallExperience";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (import.meta.env.DEV) {
      const qaRole =
        (typeof window !== "undefined" ? localStorage.getItem("QA_ROLE") : null) ||
        (import.meta.env as any).VITE_QA_ROLE;
      if (qaRole) {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — NCD Management Platform" },
      { name: "description", content: "Enterprise offline-first Non-Communicable Disease screening platform." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, changePin, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  
  // Custom states for new PIN flow
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsPinChange, setNeedsPinChange] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(true);
  
  const globalSettings = useSettings((s) => s.globalSettings);
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme as string === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    useSettings.getState().loadSettings();
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated && !user?.mustChangePin && !needsPinChange) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, navigate, user, needsPinChange]);

  const submitSignIn = async (overridePin?: string) => {
    const finalPin = overridePin ?? pin;
    if (!userId.trim()) {
      toast.error("Enter your User ID.");
      return;
    }
    if (finalPin.length !== PIN_LENGTH) {
      return; // Handled visually
    }
    setBusy(true);
    try {
      const nextUser = await signIn(userId, finalPin);
      if (nextUser?.mustChangePin) {
        setNeedsPinChange(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid User ID or PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const submitChangePin = async (overrideConfirmPin?: string) => {
    const finalConfirm = overrideConfirmPin ?? confirmPin;
    if (newPin.length !== PIN_LENGTH || finalConfirm.length !== PIN_LENGTH) return;
    if (newPin !== finalConfirm) {
      toast.error("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      await changePin(newPin);
      toast.success("PIN updated successfully.");
      setNeedsPinChange(false);
      void navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to update PIN");
    } finally {
      setBusy(false);
    }
  };

  // Custom 6-digit PIN Input component
  const CustomPinInput = ({ 
    value, 
    onChange, 
    onComplete 
  }: { 
    value: string, 
    onChange: (val: string) => void,
    onComplete: (val: string) => void
  }) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Backspace") {
        if (!value[index] && index > 0) {
          // If empty and backspace is pressed, move focus to previous and clear it
          const newValue = value.slice(0, index - 1) + value.slice(index);
          onChange(newValue);
          inputRefs.current[index - 1]?.focus();
        }
      } else if (e.key === "ArrowLeft") {
        if (index > 0) inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight") {
        if (index < PIN_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      if (!val) {
        // Clear current digit
        const newValue = value.slice(0, index) + " " + value.slice(index + 1);
        onChange(newValue.trim());
        return;
      }
      
      const char = val[val.length - 1]; // take last char typed
      const newValue = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, PIN_LENGTH);
      onChange(newValue.replace(/\s/g, '')); // remove spaces
      
      if (index < PIN_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      
      if (newValue.replace(/\s/g, '').length === PIN_LENGTH) {
        onComplete(newValue.replace(/\s/g, ''));
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
      if (pasted) {
        onChange(pasted);
        if (pasted.length === PIN_LENGTH) {
          inputRefs.current[PIN_LENGTH - 1]?.focus();
          onComplete(pasted);
        } else {
          inputRefs.current[pasted.length]?.focus();
        }
      }
    };

    return (
      <div className="flex items-center gap-1 sm:gap-2 w-full max-w-full">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const char = value[i] || "";
          return (
            <input 
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={char}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={cn(
                "w-[2rem] h-[2rem] sm:w-[2.5rem] sm:h-[2.5rem] shrink-0 rounded-full border transition-all text-center text-lg sm:text-2xl font-black bg-white dark:bg-slate-900 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus:ring-1 focus:ring-blue-500",
                char ? "border-blue-200 dark:border-blue-900/50 text-slate-800 dark:text-white" : "border-slate-200 dark:border-slate-700 text-transparent caret-blue-500"
              )}
            />
          );
        })}
      </div>
    );
  };

  const appName = globalSettings?.app_name || appConfig.name;
  const orgName = globalSettings?.organization_name || "Enterprise NGO Healthcare Suite";

  const renderAuthForm = () => {
    if (needsPinChange || user?.mustChangePin) {
      return (
        <div className="w-full max-w-[25rem] mx-auto relative group z-20">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent rounded-[2rem] blur-2xl opacity-60 transition duration-500 hidden lg:block" />
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl space-y-7 p-7 sm:p-9 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] relative overflow-hidden border border-white/60 dark:border-slate-700/50">
            <div className="relative z-10 text-center space-y-3 mb-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Update PIN</h2>
              <p className="text-sm text-slate-500 font-medium">Please secure your account.</p>
            </div>
            <div className="relative z-10 space-y-5">
              
              {/* New PIN Input Block */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-all focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="mt-1 size-10 rounded-full flex items-center justify-center shrink-0">
                    <Lock className="size-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">New PIN</label>
                    <CustomPinInput value={newPin} onChange={setNewPin} onComplete={() => {}} />
                  </div>
                </div>
              </div>

              {/* Confirm PIN Input Block */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-all focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="mt-1 size-10 rounded-full flex items-center justify-center shrink-0">
                    <Lock className="size-5 text-slate-400" />
                  </div>
                  <div className="flex-1 relative">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Confirm PIN</label>
                    <CustomPinInput value={confirmPin} onChange={setConfirmPin} onComplete={submitChangePin} />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button className="h-[3.25rem] w-full rounded-full text-base font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all bg-blue-600 hover:bg-blue-700 text-white" disabled={busy || newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH} onClick={() => void submitChangePin()}>
                  {busy ? "Updating..." : "Secure My Account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-[420px] mx-auto z-10 relative">
        <div className="bg-white/95 dark:bg-slate-900/80 backdrop-blur-2xl space-y-7 p-7 sm:p-[2.25rem] rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(10,27,63,0.1)] relative overflow-hidden border border-white dark:border-slate-700/50">
          
          <div className="relative z-10 text-center space-y-1 mb-2">
            <div className="mx-auto flex size-[3.5rem] items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-lg text-xl mb-5 overflow-hidden">
              <img src={globalSettings?.app_logo || "/logo.jpg"} alt="Logo" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = appName[0]; }} />
            </div>
            <h2 className="font-display text-[19px] font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {appName}
            </h2>
            <p className="text-[12px] text-slate-500 font-medium pb-2">{orgName}</p>
            <div className="pt-3">
              <h3 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Sign in</h3>
              <p className="text-[13px] text-slate-500 font-medium mt-1">Enter your User ID and 6-digit PIN</p>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            
            {/* Custom Input Block: User ID */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[1.75rem] px-5 py-4 shadow-sm transition-all focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-md flex items-center gap-4">
              <div className="size-8 rounded-full flex items-center justify-center shrink-0">
                <User className="size-[22px] text-slate-500" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <label htmlFor="userId" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">
                  User ID / Username
                </label>
                <input 
                  id="userId"
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-[16px] font-bold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:ring-0 leading-tight"
                  placeholder="e.g. admin or chw_1"
                />
              </div>
            </div>

            {/* Custom Input Block: PIN */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[1.75rem] px-5 py-4 shadow-sm transition-all focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-md relative">
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-full flex items-center justify-center shrink-0">
                  <Lock className="size-[22px] text-slate-500" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 pr-16">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">6-digit PIN</label>
                  <CustomPinInput value={pin} onChange={setPin} onComplete={submitSignIn} />
                </div>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 right-5 bg-transparent">
                <button className="text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors">Forgot?</button>
              </div>
            </div>
            
            <div className="pt-2">
              <Button className="h-[3.5rem] w-full rounded-[1.75rem] text-[17px] font-bold shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white" disabled={busy} onClick={() => void submitSignIn()}>
                {busy ? "Signing in…" : <>Sign in <ArrowRight className="size-5" /></>}
              </Button>
            </div>
          </div>
          
          <div className="relative z-10 pt-4 pb-1 text-center mt-2 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <ShieldCheck className="size-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-500 font-bold">Protected by organization policies</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const mobileFeatureCards = [
    {
      icon: <HeartPulse className="size-[22px] text-white" />,
      title: "Clinical Algorithms",
      desc: "Standardized risk stratification with 30+ filters.",
      bg: "bg-blue-600",
    },
    {
      icon: <Users className="size-[22px] text-white" />,
      title: "Household Tracking",
      desc: "Real-time field data and geospatial insights.",
      bg: "bg-blue-600",
    },
    {
      icon: <BarChart3 className="size-[22px] text-white" />,
      title: "Analytics",
      desc: "Dynamic dashboards for better decisions.",
      bg: "bg-blue-600",
    },
    {
      icon: <MapPin className="size-[22px] text-white" />,
      title: "Geofencing",
      desc: "Polygon boundaries and GPS tracking.",
      bg: "bg-blue-600",
    },
  ];

  const desktopFeaturesLeft = [
    {
      icon: <Users className="size-[22px] text-white" />,
      title: "Household Tracking",
      desc: "Map every household with real-time field data.",
    },
    {
      icon: <HeartPulse className="size-[22px] text-white" />,
      title: "Clinical Algorithms",
      desc: "Standardized risk stratification with 30+ filters.",
    },
    {
      icon: <BarChart3 className="size-[22px] text-white" />,
      title: "Actionable Analytics",
      desc: "Dynamic dashboards for better decisions.",
    },
    {
      icon: <CloudOff className="size-[22px] text-white" />,
      title: "Offline-First",
      desc: "Works offline, syncs when online. No data loss.",
    },
  ];

  const desktopFeaturesRight = [
    {
      icon: <MapPin className="size-[22px] text-white" />,
      title: "Geospatial Mapping",
      desc: "Polygon boundaries, GPS tracking and assignments.",
    },
    {
      icon: <CalendarCheck className="size-[22px] text-white" />,
      title: "Smart Follow-ups",
      desc: "Automated scheduling with zero duplicate visits.",
    },
    {
      icon: <ShieldCheck className="size-[22px] text-white" />,
      title: "Data Security",
      desc: "Built with privacy, security and trust.",
    },
    {
      icon: <Users className="size-[22px] text-white" />,
      title: "Stronger Communities",
      desc: "Better data. Timely care. Healthier lives.",
    },
  ];

  return (
    <PublicLayout>
      {showInstallPopup && <MobileInstallExperience onSkip={() => setShowInstallPopup(false)} />}
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 bg-[#f4f7fb] dark:bg-[#0a1020] transition-colors duration-500 overflow-hidden">
        {/* Ambient base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-blue-100/30 dark:from-blue-900/10 dark:to-transparent" />
        
        {/* Sweeping curve highlights */}
        <div className="absolute top-[10%] left-[-20%] w-[140%] h-[50rem] bg-gradient-to-b from-white/60 to-transparent dark:from-white/5 rounded-[100%] blur-3xl transform -rotate-6 opacity-80" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60rem] h-[60rem] bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-[100px] opacity-70" />
      </div>

      {/* Container holding the entire page content */}
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center pt-28 lg:pt-40 px-4 overflow-hidden z-0">
        
        {/* Hero Header */}
        <div className="text-center max-w-[54rem] mx-auto space-y-6 mb-12 lg:mb-[4.5rem] relative z-10 w-full px-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50/80 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-4 py-1.5 text-[12px] font-bold text-blue-600 dark:text-blue-400 shadow-sm backdrop-blur-md mx-auto">
            <Activity className="size-3.5" />
            <span>Offline-First NCD Care Loop</span>
          </div>
          
          <h1 className="font-display text-[2.75rem] leading-[1.05] lg:text-[4.5rem] lg:leading-[1] font-extrabold tracking-tight text-[#0a1b3f] dark:text-white">
            Healthier Communities <br className="hidden lg:block" />
            <span className="text-blue-600">Stronger Tomorrows</span>
          </h1>
          
          <p className="text-[15px] lg:text-[18px] text-[#4b5c7e] dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Empowering field operatives and clinical supervisors with geospatial household tracking, automatic risk calculations, and intelligent follow-up scheduling.
          </p>
        </div>

        {/* Desktop Layout: Features (Left) + Login + Features (Right) */}
        <div className="w-full max-w-[1920px] mx-auto hidden lg:grid grid-cols-12 gap-6 items-center justify-center px-4 xl:px-12 2xl:px-24 mb-16 relative z-10">
          <div className="col-span-4 flex flex-col gap-9 items-end pr-4 xl:pr-10">
            {desktopFeaturesLeft.map((feat, i) => (
              <div key={i} className="flex gap-4 max-w-[320px] text-right justify-end group">
                <div className="pt-0.5">
                  <h3 className="font-bold text-[#0a1b3f] dark:text-white text-[16px] group-hover:text-blue-600 transition-colors">{feat.title}</h3>
                  <p className="text-[13.5px] text-[#4b5c7e] dark:text-slate-400 font-medium mt-1 leading-relaxed">{feat.desc}</p>
                </div>
                <div className="flex-shrink-0 size-[3.25rem] rounded-full flex items-center justify-center bg-blue-600 text-white shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                  {feat.icon}
                </div>
              </div>
            ))}
          </div>
          
          <div className="col-span-4 flex justify-center">
            {renderAuthForm()}
          </div>
          
          <div className="col-span-4 flex flex-col gap-9 items-start pl-4 xl:pl-10">
            {desktopFeaturesRight.map((feat, i) => (
              <div key={i} className="flex gap-4 max-w-[320px] text-left justify-start group">
                <div className="flex-shrink-0 size-[3.25rem] rounded-full flex items-center justify-center bg-blue-600 text-white shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                  {feat.icon}
                </div>
                <div className="pt-0.5">
                  <h3 className="font-bold text-[#0a1b3f] dark:text-white text-[16px] group-hover:text-blue-600 transition-colors">{feat.title}</h3>
                  <p className="text-[13.5px] text-[#4b5c7e] dark:text-slate-400 font-medium mt-1 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Layout: 2x2 Feature Cards + Login */}
        <div className="w-full lg:hidden space-y-12 mb-8 relative z-10 px-4">
          <div className="grid grid-cols-2 gap-4 max-w-[400px] mx-auto">
            {mobileFeatureCards.map((feat, i) => (
              <div key={i} className="flex flex-col text-center items-center p-5 rounded-[1.75rem] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white dark:border-slate-800">
                <div className={cn("size-[3.25rem] rounded-full flex items-center justify-center mb-4 shadow-sm", feat.bg)}>
                  {feat.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-[14px] leading-tight mb-1.5">{feat.title}</h3>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed px-1">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center w-full">
            {renderAuthForm()}
          </div>
        </div>

        {/* Desktop Statistics Bar */}
        <div className="hidden lg:flex w-full max-w-[1920px] mx-auto justify-center mb-6 relative z-10 px-8">
          <div className="flex items-center gap-16 py-8">
            <div className="flex items-center gap-4">
              <div className="text-slate-600 dark:text-slate-400">
                <Users className="size-[26px]" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-extrabold text-[20px] text-[#0a1b3f] dark:text-white leading-tight">10K+</p>
                <p className="text-[14px] text-[#4b5c7e] font-medium">Households Mapped</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-slate-600 dark:text-slate-400">
                <Users className="size-[26px]" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-extrabold text-[20px] text-[#0a1b3f] dark:text-white leading-tight">50K+</p>
                <p className="text-[14px] text-[#4b5c7e] font-medium">Members</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-slate-600 dark:text-slate-400">
                <BarChart3 className="size-[26px]" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-extrabold text-[20px] text-[#0a1b3f] dark:text-white leading-tight">95%</p>
                <p className="text-[14px] text-[#4b5c7e] font-medium">Follow-up Rate</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-slate-600 dark:text-slate-400">
                <ShieldCheck className="size-[26px]" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-extrabold text-[20px] text-[#0a1b3f] dark:text-white leading-tight">Safer</p>
                <p className="text-[14px] text-[#4b5c7e] font-medium">Healthier Communities</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PublicLayout>
  );
}
