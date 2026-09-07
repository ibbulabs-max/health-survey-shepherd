import { useState, useEffect } from "react";
import { Apple, Smartphone, Monitor, MonitorUp, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";

export function MobileInstallExperience({ onSkip }: { onSkip: () => void }) {
  const [isStandalone, setIsStandalone] = useState(true); // Default true to prevent flash
  const [platform, setPlatform] = useState<"ios" | "android" | "mac" | "windows" | "unknown">("unknown");
  const { globalSettings } = useSettings();

  useEffect(() => {
    // Detect Standalone (Installed) mode
    const isPWA = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes("android-app://");
    
    setIsStandalone(!!isPWA);

    // Detect Platform
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else if (/mac os x/.test(ua)) setPlatform("mac");
    else if (/windows/.test(ua)) setPlatform("windows");
  }, []);

  // Only show on mobile screens if NOT installed
  if (isStandalone) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col lg:hidden overflow-y-auto">
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="icon" className="rounded-full bg-slate-100 dark:bg-slate-900" onClick={onSkip}>
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex-1 px-6 pb-12 flex flex-col items-center">
        <div className="size-20 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white shadow-xl mb-6">
          <Download className="size-10" />
        </div>
        
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-center mb-3">
          Get the Native App
        </h2>
        <p className="text-center text-slate-500 text-sm font-medium mb-10 px-4">
          For the best offline experience, please install the application on your device.
        </p>

        <div className="w-full space-y-4 max-w-sm">
          {/* iOS */}
          <div className={`p-4 rounded-3xl border-2 transition-all ${platform === 'ios' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                <Apple className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">iPhone & iPad {platform === 'ios' && <span className="text-[10px] uppercase bg-blue-500 text-white px-2 py-0.5 rounded-full ml-1">Detected</span>}</h3>
                <p className="text-xs text-slate-500 mt-1">Tap Share &rsaquo; Add to Home Screen</p>
              </div>
            </div>
          </div>

          {/* Android */}
          <div className={`p-4 rounded-3xl border-2 transition-all ${platform === 'android' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Smartphone className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Android {platform === 'android' && <span className="text-[10px] uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full ml-1">Detected</span>}</h3>
                <p className="text-xs text-slate-500 mt-1">Download official APK or install PWA</p>
              </div>
            </div>
            {platform === 'android' && globalSettings?.download_android_url && (
               <Button className="w-full mt-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                 <a href={globalSettings.download_android_url}>Download APK</a>
               </Button>
            )}
          </div>

          {/* Windows */}
          <div className={`p-4 rounded-3xl border-2 transition-all ${platform === 'windows' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Monitor className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Windows {platform === 'windows' && <span className="text-[10px] uppercase bg-blue-500 text-white px-2 py-0.5 rounded-full ml-1">Detected</span>}</h3>
                <p className="text-xs text-slate-500 mt-1">Desktop Application</p>
              </div>
            </div>
          </div>

          {/* Mac */}
          <div className={`p-4 rounded-3xl border-2 transition-all ${platform === 'mac' ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/50' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                <MonitorUp className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">macOS {platform === 'mac' && <span className="text-[10px] uppercase bg-slate-500 text-white px-2 py-0.5 rounded-full ml-1">Detected</span>}</h3>
                <p className="text-xs text-slate-500 mt-1">Universal Binary</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-sm">
          <Button 
            className="w-full rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={() => {
              const shareData = {
                title: globalSettings?.app_name || "NCD Management Platform",
                text: "Check out the NCD Management Platform app!",
                url: window.location.href
              };
              if (navigator.share) {
                navigator.share(shareData).catch(console.error);
              } else {
                window.location.href = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + " " + shareData.url)}`;
              }
            }}
          >
            Share App Link
          </Button>

          <button onClick={onSkip} className="text-[13px] font-bold text-slate-400 hover:text-slate-600 underline underline-offset-4">
            Continue to Web Version
          </button>
        </div>
      </div>
    </div>
  );
}
