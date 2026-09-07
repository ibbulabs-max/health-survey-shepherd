import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { globalSettings } = useSettings();
  
  if (globalSettings?.terms_html) {
    return (
      <PublicLayout>
        <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 prose prose-slate dark:prose-invert" dangerouslySetInnerHTML={{ __html: globalSettings.terms_html }} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        
        <h2>Acceptance of Terms</h2>
        <p>By accessing and using this application, you agree to comply with these terms. This application is restricted to authorized healthcare field workers, supervisors, and administrators.</p>
        
        <h2>Account Responsibilities</h2>
        <p>You are responsible for maintaining the confidentiality of your 6-digit PIN and account credentials. Sharing your PIN or allowing unauthorized access to the application is strictly prohibited.</p>
        
        <h2>Data Responsibilities</h2>
        <p>You agree to enter accurate, truthful clinical and demographic data to the best of your ability. Falsifying healthcare records is grounds for immediate termination of access.</p>
        
        <h2>Prohibited Usage</h2>
        <ul>
          <li>Attempting to bypass role-based security or Row Level Security policies.</li>
          <li>Exporting data for unauthorized external use.</li>
          <li>Using the application outside of official organizational duties.</li>
        </ul>

        <h2>Support & Contact</h2>
        <p>If you encounter technical issues, please use the Help & Support channels provided within the application.</p>

        <p className="text-sm text-muted-foreground mt-12 pt-8 border-t border-border">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </PublicLayout>
  );
}
