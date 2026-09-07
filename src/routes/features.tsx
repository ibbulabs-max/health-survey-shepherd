import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Users, Map, ShieldCheck, FileSpreadsheet, BarChart3, CloudOff, Target } from "lucide-react";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
});

function FeaturesPage() {
  const featureSections = [
    {
      title: "Household & Member Management",
      icon: <Users className="size-8 text-blue-500" />,
      items: [
        "Create and map households directly in the field.",
        "Add multiple members per household with localized IDs.",
        "Track demographics and core health metrics over time.",
      ],
    },
    {
      title: "Geospatial Operations & Territories",
      icon: <Map className="size-8 text-emerald-500" />,
      items: [
        "Draw custom polygon areas for worker assignments.",
        "Visualize households as dynamic pins on the map.",
        "Privacy-first location sharing with grace periods.",
      ],
    },
    {
      title: "Clinical Assessments & Follow-ups",
      icon: <Target className="size-8 text-red-500" />,
      items: [
        "Standardized screening forms for BP, Glucose, and BMI.",
        "Automatic clinical risk stratification engine.",
        "Smart follow-up scheduling with zero-duplicate protection.",
      ],
    },
    {
      title: "100% Offline-First Architecture",
      icon: <CloudOff className="size-8 text-slate-500" />,
      items: [
        "PWA-based local-first data store.",
        "Continue screening and mapping without internet.",
        "Automatic background synchronization upon reconnection.",
      ],
    },
    {
      title: "Enterprise Data Analytics",
      icon: <BarChart3 className="size-8 text-indigo-500" />,
      items: [
        "Supervisor dashboards for real-time KPI tracking.",
        "Data quality monitors for duplicate or anomalous entries.",
        "Export and reporting tools for external stakeholders.",
      ],
    },
    {
      title: "Role-Based Access & Security",
      icon: <ShieldCheck className="size-8 text-purple-500" />,
      items: [
        "Strict Supabase Row Level Security (RLS).",
        "Granular roles: CHW, Supervisor, Admin, Master Admin.",
        "Data isolation per organization/project.",
      ],
    },
  ];

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 pt-32 pb-16">
        <div className="text-center space-y-4 mb-16">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Platform <span className="text-primary">Features</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            A comprehensive suite of tools built for enterprise NGO healthcare operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {featureSections.map((section, idx) => (
            <div key={idx} className="p-8 rounded-[2rem] bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                  {section.icon}
                </div>
                <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              </div>
              <ul className="space-y-3">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
