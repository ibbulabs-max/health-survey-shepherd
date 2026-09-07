import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const { globalSettings } = useSettings();
  
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 pt-32 pb-16">
        <div className="text-center space-y-4 mb-16">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Get in <span className="text-primary">Touch</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            We're here to help you deploy, manage, and scale your field operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-sm">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <MessageCircle className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">WhatsApp Support</h3>
                <p className="text-muted-foreground mb-3 text-sm">Fastest way to get technical assistance.</p>
                <a 
                  href={`https://wa.me/${globalSettings?.contact_whatsapp?.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-emerald-600 hover:underline"
                >
                  Message us on WhatsApp
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-sm">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Phone className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Phone Number</h3>
                <p className="text-muted-foreground mb-3 text-sm">For urgent enterprise support escalations.</p>
                <p className="font-semibold text-foreground">{globalSettings?.contact_phone || "+1 (555) 000-0000"}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-sm">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <Mail className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Email</h3>
                <p className="text-muted-foreground mb-3 text-sm">General inquiries and partnerships.</p>
                <p className="font-semibold text-foreground">support@ibrahimlabs.com</p>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-border h-full flex flex-col justify-center text-center">
            <div className="mx-auto p-4 bg-primary/10 text-primary rounded-full mb-6">
              <MapPin className="size-10" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-4">Headquarters</h3>
            <p className="text-muted-foreground leading-relaxed">
              Ibrahim Labs <br />
              Enterprise Healthcare Solutions <br />
              Global Remote Team
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
