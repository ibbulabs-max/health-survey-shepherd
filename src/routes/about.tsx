import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Activity, ShieldCheck, MapPin, Database, HeartPulse, Smartphone } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const { globalSettings } = useSettings();
  const orgName = globalSettings?.organization_name || "Enterprise NGO Healthcare Suite";
  
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            About <span className="text-primary">{orgName}</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            Transforming community health through localized geospatial tracking, offline-first workflows, and clinical risk algorithms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-border">
            <HeartPulse className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Our Mission</h3>
            <p className="text-muted-foreground leading-relaxed">
              We believe every household deserves accurate, timely health screening regardless of their internet connection. Our goal is to close the gap in non-communicable disease tracking.
            </p>
          </div>
          <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-border">
            <ShieldCheck className="size-10 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground leading-relaxed">
              Data privacy is embedded in our foundation. With comprehensive Row Level Security and localized storage, patient data is kept secure and compliant with health regulations.
            </p>
          </div>
          <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-border">
            <MapPin className="size-10 text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Geospatial Intelligence</h3>
            <p className="text-muted-foreground leading-relaxed">
              We empower supervisors with polygon territory mapping and live CHW deployment metrics, ensuring no household is left behind in the field.
            </p>
          </div>
          <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-border">
            <Smartphone className="size-10 text-purple-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Offline-First Design</h3>
            <p className="text-muted-foreground leading-relaxed">
              Our mobile apps are built for environments with zero connectivity. Screen, log, and process locally, and sync to the cloud automatically when a connection is restored.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
