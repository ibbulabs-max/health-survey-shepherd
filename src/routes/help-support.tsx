import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { BookOpen, LifeBuoy, Wrench, MessageCircle } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/help-support")({
  component: HelpSupportPage,
});

function HelpSupportPage() {
  const { globalSettings } = useSettings();

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 pt-32 pb-16">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
            <LifeBuoy className="size-3.5" />
            <span>Support Center</span>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            How can we <span className="text-primary">help you?</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="size-16 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-500 flex items-center justify-center mb-6">
              <BookOpen className="size-8" />
            </div>
            <h3 className="text-xl font-bold mb-3">Knowledge Base</h3>
            <p className="text-muted-foreground text-sm mb-6 flex-1">
              Read guides on how to install the PWA, log in, and use map tools.
            </p>
            <Link to="/faq" className="w-full py-2.5 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Read FAQs
            </Link>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="size-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center mb-6">
              <MessageCircle className="size-8" />
            </div>
            <h3 className="text-xl font-bold mb-3">Live Chat</h3>
            <p className="text-muted-foreground text-sm mb-6 flex-1">
              Talk directly to our support team on WhatsApp for immediate help.
            </p>
            <a href={`https://wa.me/${globalSettings?.contact_whatsapp?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full block py-2.5 rounded-xl font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
              Chat on WhatsApp
            </a>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="size-16 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-500 flex items-center justify-center mb-6">
              <Wrench className="size-8" />
            </div>
            <h3 className="text-xl font-bold mb-3">Technical Issues</h3>
            <p className="text-muted-foreground text-sm mb-6 flex-1">
              Experiencing a bug or sync failure? Send our engineering team an email.
            </p>
            <Link to="/contact" className="w-full py-2.5 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Contact Us
            </Link>
          </div>
        </div>

        <div className="p-8 rounded-[2rem] bg-slate-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute -top-24 -right-24 size-64 bg-primary/20 blur-3xl rounded-full" />
          <div className="relative z-10 max-w-xl">
            <h3 className="text-2xl font-bold mb-2">Need to download the app?</h3>
            <p className="text-slate-400 font-medium">Get the latest optimized version for iOS, Android, Windows, or Mac from our unified download center.</p>
          </div>
          <div className="relative z-10 w-full sm:w-auto">
            <Link to="/download" className="block w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/25 transition-all text-center">
              Go to Download Center
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
