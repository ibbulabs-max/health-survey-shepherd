import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { globalSettings } = useSettings();
  
  if (globalSettings?.privacy_policy_html) {
    return (
      <PublicLayout>
        <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 prose prose-slate dark:prose-invert" dangerouslySetInnerHTML={{ __html: globalSettings.privacy_policy_html }} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="lead">Your privacy is critically important to us. This policy outlines how we collect, use, and protect healthcare and location data.</p>
        
        <h2>Information Collected</h2>
        <p>We collect information necessary for the operation of our healthcare screening services:</p>
        <ul>
          <li><strong>Account Information:</strong> User IDs and authentication credentials.</li>
          <li><strong>Household/Member Information:</strong> Demographics and identifiers entered by field workers.</li>
          <li><strong>Assessment Information:</strong> Clinical data (e.g. BP, Glucose, BMI) recorded during screening.</li>
          <li><strong>Location Information:</strong> GPS coordinates for mapping households and tracking field worker safety.</li>
        </ul>

        <h2>Role-Based Access and Data Security</h2>
        <p>Data access is strictly controlled through Row Level Security (RLS). Field workers only see data relevant to their assigned areas, while supervisors and administrators have broader access as required for their roles.</p>
        
        <h2>Offline Data and Synchronization</h2>
        <p>Due to the offline-first nature of the application, data may be stored locally on your device in a secure IndexedDB store. This data is automatically synchronized and cleared from local volatile queues when an internet connection is established.</p>
        
        <h2>Location Privacy</h2>
        <p>Location sharing for field workers can be toggled on or off. When disabled, no location telemetry is transmitted or visible to supervisors.</p>

        <p className="text-sm text-muted-foreground mt-12 pt-8 border-t border-border">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </PublicLayout>
  );
}
