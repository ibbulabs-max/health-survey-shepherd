import { useState, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { 
  ShieldAlert, Settings, Bell, Database, Users, Map as MapIcon, 
  Palette, FileSpreadsheet, Lock, Activity, LayoutDashboard, MapPin, Search, Flag, Layout, MonitorSmartphone
} from "lucide-react";
import { supabase } from "@/db/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { APP_ROLES, roleLabels, AppRole } from "@/config/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ErrorAlertCenter } from "@/components/admin/ErrorAlertCenter";
import { startTestMode, endTestMode } from "@/services/authService";

export const Route = createFileRoute("/_authenticated/master-admin")({
  beforeLoad: async () => {
    const { loadSessionUser } = await import("@/services/authService");
    const session = await loadSessionUser();
    if (session?.actualRole !== "master_admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: MasterAdminDashboard,
});

type TabId = 
  | 'general' | 'branding' | 'login-page' | 'contact-support' 
  | 'download-center' | 'legal-policies' | 'feedback'
  | 'map' | 'location-privacy' | 'analytics' | 'users-roles' 
  | 'areas' | 'pins' | 'notifications' | 'security' 
  | 'import-excel' | 'system' | 'feature-flags' | 'advanced' | 'test-mode';

function MasterAdminDashboard() {
  const { actualRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const { globalSettings } = useSettings();
  
  if (actualRole !== "master_admin") {
    return <div className="p-8 text-center text-red-500 font-medium">Access Denied</div>;
  }

  const tabs: { id: TabId; label: string; icon: any; component: React.FC }[] = [
    { id: 'general', label: '1. General', icon: Activity, component: GeneralSettingsPanel },
    { id: 'branding', label: '2. Branding', icon: Palette, component: BrandingSettingsPanel },
    { id: 'login-page', label: '3. Login Page', icon: LayoutDashboard, component: LoginPageSettingsPanel },
    { id: 'contact-support', label: '4. Contact & Support', icon: Bell, component: ContactSupportSettingsPanel },
    { id: 'download-center', label: '5. Download Center', icon: MonitorSmartphone, component: DownloadAppSettingsPanel },
    { id: 'legal-policies', label: '6. Legal & Policies', icon: FileSpreadsheet, component: LegalPoliciesPanel },
    { id: 'map', label: '7. Map Config', icon: MapIcon, component: MapSettingsPanel },
    { id: 'location-privacy', label: '8. Location & Privacy', icon: MapPin, component: LocationPrivacySettingsPanel },
    { id: 'analytics', label: '9. Analytics', icon: MonitorSmartphone, component: AnalyticsSettingsPanel },
    { id: 'users-roles', label: '10. Users & Roles', icon: Users, component: UsersRolesPanel },
    { id: 'areas', label: '11. Areas', icon: Layout, component: AreasSettingsPanel },
    { id: 'pins', label: '12. Pins', icon: MapPin, component: PinsSettingsPanel },
    { id: 'notifications', label: '13. Notifications', icon: Bell, component: NotificationsPanel },
    { id: 'feedback', label: '14. Feedback', icon: Bell, component: FeedbackPanel },
    { id: 'security', label: '15. Security', icon: Lock, component: SecuritySettingsPanel },
    { id: 'import-excel', label: '16. Import / Excel', icon: FileSpreadsheet, component: ImportExcelSettingsPanel },
    { id: 'system', label: '17. System', icon: Layout, component: SystemSettingsPanel },
    { id: 'feature-flags', label: '18. Feature Flags', icon: Layout, component: FeatureFlagsSettingsPanel },
    { id: 'advanced', label: '19. Advanced', icon: Layout, component: AdvancedSettingsPanel },
    { id: 'test-mode', label: 'TEST MODE', icon: Users, component: TestModePanel },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || GeneralSettingsPanel;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-y-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
          <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-600" />
            Control Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">Master Admin Configuration</p>
        </div>
        <nav className="p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive 
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-4xl mx-auto pb-24">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// REUSABLE SETTINGS FORM COMPONENT
// -------------------------------------------------------------------------------------------------
function SettingsForm({ 
  title, description, fields 
}: { 
  title: string, description: string, 
  fields: { key: string, label: string, type: 'text' | 'number' | 'boolean' | 'textarea', placeholder?: string }[] 
}) {
  const { globalSettings, updateGlobalSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (globalSettings) {
      const initial: any = {};
      fields.forEach(f => {
        initial[f.key] = globalSettings[f.key] ?? (f.type === 'boolean' ? false : '');
      });
      setLocalSettings(initial);
    }
  }, [globalSettings, fields]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGlobalSettings(localSettings);
      toast.success(`${title} saved successfully.`);
    } catch (err: any) {
      toast.error("Error saving settings", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map(f => (
              <div key={f.key} className={`space-y-2 ${f.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                {f.type === 'boolean' ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg border-slate-200 dark:border-slate-800">
                    <Label>{f.label}</Label>
                    <Switch 
                      checked={localSettings[f.key] || false} 
                      onCheckedChange={(checked) => setLocalSettings({ ...localSettings, [f.key]: checked })} 
                    />
                  </div>
                ) : f.type === 'textarea' ? (
                  <>
                    <Label>{f.label}</Label>
                    <Textarea 
                      placeholder={f.placeholder}
                      value={localSettings[f.key] || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, [f.key]: e.target.value })}
                    />
                  </>
                ) : (
                  <>
                    <Label>{f.label}</Label>
                    <Input 
                      type={f.type} 
                      placeholder={f.placeholder}
                      value={localSettings[f.key] || ''} 
                      onChange={(e) => setLocalSettings({ 
                        ...localSettings, 
                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value 
                      })} 
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------------------------------------
// INDIVIDUAL PANELS
// -------------------------------------------------------------------------------------------------
function GeneralSettingsPanel() {
  return <SettingsForm 
    title="General Application Settings" 
    description="Configure core application metadata."
    fields={[
      { key: 'app_name', label: 'Application Name', type: 'text' },
      { key: 'organization_name', label: 'Organization Name', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'default_language', label: 'Default Language Code', type: 'text' },
      { key: 'timezone', label: 'System Timezone', type: 'text' },
      { key: 'date_format', label: 'Date Format', type: 'text' },
    ]} 
  />;
}

function BrandingSettingsPanel() {
  return <SettingsForm 
    title="Visual Branding" 
    description="Configure logos and colors."
    fields={[
      { key: 'app_logo', label: 'App Logo URL', type: 'text' },
      { key: 'favicon', label: 'Favicon URL', type: 'text' },
      { key: 'splash_logo', label: 'Splash Screen Logo URL', type: 'text' },
      { key: 'login_logo', label: 'Login Screen Logo URL', type: 'text' },
      { key: 'primary_color', label: 'Primary Color (Hex)', type: 'text' },
      { key: 'secondary_color', label: 'Secondary Color (Hex)', type: 'text' },
      { key: 'accent_color', label: 'Accent Color (Hex)', type: 'text' },
    ]} 
  />;
}

function LoginPageSettingsPanel() {
  return <SettingsForm 
    title="Login Page Configuration" 
    description="Independent settings for Desktop and Mobile login experiences."
    fields={[
      { key: 'desktop_light_background', label: 'Desktop Background (Light Mode URL)', type: 'text' },
      { key: 'desktop_dark_background', label: 'Desktop Background (Dark Mode URL)', type: 'text' },
      { key: 'mobile_light_background', label: 'Mobile Background (Light Mode URL)', type: 'text' },
      { key: 'mobile_dark_background', label: 'Mobile Background (Dark Mode URL)', type: 'text' },
      { key: 'login_welcome_heading', label: 'Welcome Heading', type: 'text' },
      { key: 'login_description', label: 'Welcome Description', type: 'text' },
      { key: 'login_overlay_opacity', label: 'Overlay Opacity (0-100)', type: 'number' },
      { key: 'login_glass_blur', label: 'Glass Blur px', type: 'number' },
      { key: 'login_show_powered_by', label: 'Show "Powered By" Footer', type: 'boolean' },
      { key: 'login_powered_by_name', label: 'Powered By Name', type: 'text' },
      { key: 'login_powered_by_url', label: 'Powered By URL', type: 'text' },
    ]} 
  />;
}

function ContactSupportSettingsPanel() {
  return <SettingsForm 
    title="Contact & Support" 
    description="Configure support channels accessible by users."
    fields={[
      { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'text' },
      { key: 'whatsapp_message', label: 'Default WhatsApp Message', type: 'textarea' },
      { key: 'contact_email', label: 'Support Email', type: 'text' },
      { key: 'contact_number', label: 'Support Phone Number', type: 'text' },
      { key: 'help_support_url', label: 'Help Center URL', type: 'text' },
      { key: 'feedback_url', label: 'Feedback Form URL', type: 'text' },
      { key: 'enable_support_links', label: 'Enable Support Links in UI', type: 'boolean' },
    ]} 
  />;
}

function LocationPrivacySettingsPanel() {
  return <SettingsForm 
    title="Location & Privacy" 
    description="Configure working hours, tracking limits, and privacy policies."
    fields={[
      { key: 'working_hours_enabled', label: 'Enable Working Hours Checking', type: 'boolean' },
      { key: 'working_day_start', label: 'Working Day Start (HH:MM)', type: 'text' },
      { key: 'working_day_end', label: 'Working Day End (HH:MM)', type: 'text' },
      { key: 'grace_period_minutes', label: 'Grace Period (Minutes)', type: 'number' },
      { key: 'chw_location_sharing', label: 'Enable CHW Location Tracking', type: 'boolean' },
      { key: 'privacy_policy_url', label: 'Privacy Policy URL', type: 'text' },
      { key: 'terms_url', label: 'Terms of Service URL', type: 'text' },
    ]} 
  />;
}

function MapSettingsPanel() {
  return <SettingsForm 
    title="Map Configuration" 
    description="Configure the default map parameters."
    fields={[
      { key: 'map_provider', label: 'Map Provider (e.g. openstreetmap, mapbox)', type: 'text' },
      { key: 'map_default_center_lat', label: 'Default Latitude', type: 'number' },
      { key: 'map_default_center_lng', label: 'Default Longitude', type: 'number' },
      { key: 'map_default_zoom', label: 'Default Zoom Level', type: 'number' },
      { key: 'map_style_light', label: 'Light Theme Map Style URL', type: 'text' },
      { key: 'map_style_dark', label: 'Dark Theme Map Style URL', type: 'text' },
    ]} 
  />;
}

function DownloadAppSettingsPanel() {
  return <SettingsForm 
    title="Download Center / App Versions" 
    description="Configure the download URLs and version numbers for each platform."
    fields={[
      { key: 'download_current_version', label: 'Current Release Version', type: 'text' },
      { key: 'download_release_notes', label: 'Release Notes', type: 'textarea' },
      { key: 'download_mac_url', label: 'Mac OS Download URL', type: 'text' },
      { key: 'download_mac_version', label: 'Mac OS App Version', type: 'text' },
      { key: 'download_ios_url', label: 'iOS App Store URL / Instructions', type: 'text' },
      { key: 'download_ios_version', label: 'iOS App Version', type: 'text' },
      { key: 'download_android_url', label: 'Android APK / Play Store URL', type: 'text' },
      { key: 'download_android_version', label: 'Android App Version', type: 'text' },
      { key: 'download_windows_url', label: 'Windows Download URL', type: 'text' },
      { key: 'download_windows_version', label: 'Windows App Version', type: 'text' },
    ]} 
  />;
}

function LegalPoliciesPanel() {
  return <SettingsForm 
    title="Legal & Policies" 
    description="Manage Terms of Service and Privacy Policy text (supports HTML)."
    fields={[
      { key: 'privacy_policy_html', label: 'Privacy Policy (HTML)', type: 'textarea' },
      { key: 'terms_html', label: 'Terms of Service (HTML)', type: 'textarea' },
      { key: 'about_mission_html', label: 'About Us / Mission Statement (HTML)', type: 'textarea' },
      { key: 'about_who_uses_html', label: 'Who Uses This App (HTML)', type: 'textarea' },
      { key: 'faq_json', label: 'FAQ (JSON format)', type: 'textarea' },
    ]} 
  />;
}

function FeedbackPanel() {
  return <PlaceholderPanel title="Feedback" desc="View user-submitted feedback and bug reports." />;
}

// Stubs for future complex configuration views
function AnalyticsSettingsPanel() { return <PlaceholderPanel title="Analytics Config" desc="Configure BI endpoints and default dashboards." />; }
function UsersRolesPanel() { return <PlaceholderPanel title="Users & Roles" desc="Manage Role hierarchies and custom permissions." />; }
function AreasSettingsPanel() { return <PlaceholderPanel title="Areas" desc="Configure boundary geometry policies." />; }
function PinsSettingsPanel() { return <PlaceholderPanel title="Pins" desc="Manage global Pin icon sets and custom categories." />; }
function SecuritySettingsPanel() { return <PlaceholderPanel title="Security" desc="Configure 2FA, session timeouts, and IP whitelisting." />; }
function ImportExcelSettingsPanel() { return <PlaceholderPanel title="Import / Excel" desc="Manage CSV mapping templates and batch limits." />; }
function FeatureFlagsSettingsPanel() { return <PlaceholderPanel title="Feature Flags" desc="Toggle beta features and progressive rollouts." />; }
function AdvancedSettingsPanel() { return <PlaceholderPanel title="Advanced" desc="Developer keys and raw JSON overrides." />; }

function PlaceholderPanel({ title, desc }: { title: string, desc: string }) {
  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle className="text-slate-500">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">This module is part of a separate plugin architecture.</p>
      </CardContent>
    </Card>
  );
}

function NotificationsPanel() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Broadcasting</CardTitle>
          <CardDescription>Send critical alerts to all users or specific roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">Use the Notification Center to manage alerts.</p>
          <ErrorAlertCenter />
        </CardContent>
      </Card>
    </div>
  );
}
function SystemSettingsPanel() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Error Logs</CardTitle>
          <CardDescription>View grouped, non-sensitive system errors and synchronization faults.</CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorAlertCenter />
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// TEST MODE PANEL (FIXED UUID COERCION BUG)
// -------------------------------------------------------------------------------------------------
function TestModePanel() {
  const { user, isTestMode, refresh } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole>("survey_user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [usersList, setUsersList] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', selectedRole);
      if (!roles?.length) { setUsersList([]); return; }
      
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', roles.map(r => r.user_id));
      setUsersList((profiles || []).map(p => ({
        id: p.id, 
        name: p.full_name || p.username || 'Unknown',
      })));
    };
    loadUsers();
  }, [selectedRole]);

  const handleStartTestMode = async () => {
    setLoading(true);
    try {
      // Clear existing sessions
      await supabase.from("test_mode_sessions").update({ active: false }).eq("master_admin_id", user?.id);
      
      const { error } = await supabase.from("test_mode_sessions").insert({
        master_admin_id: user?.id,
        simulated_role: selectedRole,
        simulated_user_id: selectedUserId || null, 
        active: true,
      });

      if (error) throw error;
      await refresh();
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error("Test Mode Error", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEndTestMode = async () => {
    setLoading(true);
    try {
      await endTestMode();
      await refresh();
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error("Error", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-900 shadow-sm">
      <CardHeader className="bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900">
        <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          Test Mode / Impersonation
        </CardTitle>
        <CardDescription>
          Temporarily inherit the exact RLS context, permissions, and layout of another user role.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {isTestMode ? (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-md border border-orange-200 dark:border-orange-800">
              <strong>Active Simulation:</strong> You are currently simulating a {user?.role} session.
            </div>
            <Button onClick={handleEndTestMode} disabled={loading} variant="destructive">
              {loading ? "Exiting..." : "Exit Test Mode"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role to Simulate</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                  value={selectedRole} 
                  onChange={e => { setSelectedRole(e.target.value as AppRole); setSelectedUserId(""); }}
                >
                  {APP_ROLES.filter(r => r !== "master_admin" && r !== "super_admin").map(role => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Specific User (Optional)</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- General Role Only (No specific user) --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={handleStartTestMode} disabled={loading}>
              {loading ? "Starting..." : "Begin Simulation"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
