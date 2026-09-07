import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Monitor, Smartphone, MonitorUp, Apple, CheckCircle2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
});

function DownloadPage() {
  const { globalSettings } = useSettings();

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 pt-32 pb-16">
        <div className="text-center space-y-4 mb-16">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Download <span className="text-primary">Center</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            Install the Management App optimized for your specific device and operating system.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* iOS / iPhone */}
          <div className="flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-32 bg-slate-100 dark:bg-slate-800 rounded-full transition-transform group-hover:scale-150 z-0" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="size-14 rounded-2xl bg-black text-white flex items-center justify-center mb-6 shadow-md">
                <Apple className="size-7" />
              </div>
              <h3 className="font-bold text-xl mb-1">iPhone & iPad</h3>
              <p className="text-xs font-semibold text-primary mb-4">v{globalSettings?.download_ios_version || "3.0.0"}</p>
              <p className="text-sm text-muted-foreground mb-8 flex-1">
                Install as a PWA directly from Safari by tapping "Share" and "Add to Home Screen".
              </p>
              <Button className="w-full rounded-xl font-bold bg-black hover:bg-black/80 text-white" asChild>
                <a href={globalSettings?.download_ios_url || "#"}>
                  Installation Guide
                </a>
              </Button>
            </div>
          </div>

          {/* Android */}
          <div className="flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-32 bg-emerald-50 dark:bg-emerald-950/30 rounded-full transition-transform group-hover:scale-150 z-0" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="size-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-6 shadow-md">
                <Smartphone className="size-7" />
              </div>
              <h3 className="font-bold text-xl mb-1">Android</h3>
              <p className="text-xs font-semibold text-primary mb-4">v{globalSettings?.download_android_version || "3.0.0"}</p>
              <p className="text-sm text-muted-foreground mb-8 flex-1">
                Download the official APK or install via Google Play for seamless offline screening.
              </p>
              <Button className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                <a href={globalSettings?.download_android_url || "#"}>
                  Download APK
                </a>
              </Button>
            </div>
          </div>

          {/* Windows */}
          <div className="flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-32 bg-blue-50 dark:bg-blue-950/30 rounded-full transition-transform group-hover:scale-150 z-0" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="size-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-md">
                <Monitor className="size-7" />
              </div>
              <h3 className="font-bold text-xl mb-1">Windows</h3>
              <p className="text-xs font-semibold text-primary mb-4">v{globalSettings?.download_windows_version || "3.0.0"}</p>
              <p className="text-sm text-muted-foreground mb-8 flex-1">
                Desktop application optimized for Windows 10/11 supervisors and administrators.
              </p>
              <Button className="w-full rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <a href={globalSettings?.download_windows_url || "#"}>
                  Download for Windows
                </a>
              </Button>
            </div>
          </div>

          {/* Mac */}
          <div className="flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-32 bg-slate-100 dark:bg-slate-800 rounded-full transition-transform group-hover:scale-150 z-0" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="size-14 rounded-2xl bg-slate-700 text-white flex items-center justify-center mb-6 shadow-md">
                <MonitorUp className="size-7" />
              </div>
              <h3 className="font-bold text-xl mb-1">macOS</h3>
              <p className="text-xs font-semibold text-primary mb-4">v{globalSettings?.download_mac_version || "3.0.0"}</p>
              <p className="text-sm text-muted-foreground mb-8 flex-1">
                Universal binary for Intel and Apple Silicon Macs. Install as a standalone app.
              </p>
              <Button className="w-full rounded-xl font-bold bg-slate-700 hover:bg-slate-800 text-white" asChild>
                <a href={globalSettings?.download_mac_url || "#"}>
                  Download for Mac
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        <div className="mt-16 bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Already using the web version?</h3>
            <p className="text-muted-foreground text-sm">
              If your browser supports Progressive Web Apps (PWA), you can click the "Install" icon in your URL bar right now to get the standalone experience without downloading an installer.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
