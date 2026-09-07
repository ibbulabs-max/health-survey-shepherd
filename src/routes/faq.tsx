import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/faq")({
  component: FAQPage,
});

function FAQPage() {
  const { globalSettings } = useSettings();
  
  // Note: Future iteration will parse globalSettings?.faq_json
  
  const faqs = [
    {
      category: "Account & Login",
      questions: [
        { q: "How do I log in?", a: "Enter your User ID and the 6-digit PIN assigned to you by your supervisor." },
        { q: "What is my User ID?", a: "Your User ID is typically your username (e.g. admin, chw_1). Contact your supervisor if you have forgotten it." },
        { q: "What is the 6-digit PIN?", a: "It is a secure 6-digit number used instead of a complex password to make field login easier." },
        { q: "What happens if I enter the wrong PIN?", a: "After multiple failed attempts, your account may be temporarily locked. Please contact support." }
      ]
    },
    {
      category: "Application & Field Work",
      questions: [
        { q: "What does offline-first mean?", a: "You can use the app without an internet connection. Data is saved to your device and syncs automatically when you go online." },
        { q: "How are households managed?", a: "You can map households by dropping pins on the map, then add individual members to that household." },
        { q: "How do follow-ups work?", a: "The system automatically schedules follow-ups based on clinical algorithms. Check your Tasks tab daily." }
      ]
    },
    {
      category: "Map & Privacy",
      questions: [
        { q: "What are working areas?", a: "Polygons drawn by supervisors to define boundaries for CHW operations." },
        { q: "Who can see my location?", a: "Only your supervisors can see your location, and only while location sharing is active." },
        { q: "What happens when location sharing is OFF?", a: "Your current location is no longer tracked or exposed to anyone." }
      ]
    }
  ];

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 pt-32 pb-16">
        <div className="text-center space-y-4 mb-16">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Frequently Asked <span className="text-primary">Questions</span>
          </h1>
        </div>

        <div className="space-y-12">
          {faqs.map((group, idx) => (
            <div key={idx} className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground border-b border-border pb-2">{group.category}</h2>
              <div className="space-y-4">
                {group.questions.map((item, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border">
                    <h3 className="font-bold text-lg mb-2">{item.q}</h3>
                    <p className="text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
