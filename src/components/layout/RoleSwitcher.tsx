import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { APP_ROLES, roleLabels, type AppRole } from "@/config/roles";
import { startTestMode, endTestMode } from "@/services/authService";
import { supabase } from "@/db/client";

export function RoleSwitcher() {
  const { user, actualRole, isTestMode, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  // Only Master Admins can see the role switcher
  if (actualRole !== "master_admin") {
    return null;
  }

  // Get current active role for display
  const currentDisplayRole = user?.testSession
    ? (user.testSession.simulatedRole as AppRole)
    : "master_admin";

  const cycleRole = async (direction: "next" | "prev") => {
    setLoading(true);
    try {
      const currentIndex = APP_ROLES.indexOf(currentDisplayRole);
      let nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      
      if (nextIndex < 0) nextIndex = APP_ROLES.length - 1;
      if (nextIndex >= APP_ROLES.length) nextIndex = 0;
      
      const nextRole = APP_ROLES[nextIndex] as AppRole;

      if (nextRole === "master_admin") {
        await endTestMode();
      } else {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', nextRole).limit(1);
        const targetUserId = roles && roles.length > 0 ? roles[0]?.user_id : null;
        if (!targetUserId) throw new Error(`No users found with role: ${roleLabels[nextRole]}`);
        
        await endTestMode();
        await startTestMode(nextRole, targetUserId);
      }

      await refresh();
      window.location.href = "/dashboard";
    } catch (err: any) {
      alert("Test Mode Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const roleText = currentDisplayRole === "master_admin" 
    ? "MASTER ADMIN" 
    : `${roleLabels[currentDisplayRole].toUpperCase()} • TEST MODE`;

  return (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-1 text-amber-600">
      <ShieldAlert className="size-3.5" />
      <button 
        disabled={loading} 
        onClick={() => cycleRole("prev")}
        className="p-1 hover:bg-amber-500/20 rounded-full transition-colors disabled:opacity-50"
      >
        <ChevronLeft className="size-3" />
      </button>
      
      <span className="text-[11px] font-bold min-w-[120px] text-center uppercase tracking-wider">
        {loading ? <Loader2 className="size-3 animate-spin mx-auto" /> : roleText}
      </span>
      
      <button 
        disabled={loading} 
        onClick={() => cycleRole("next")}
        className="p-1 hover:bg-amber-500/20 rounded-full transition-colors disabled:opacity-50"
      >
        <ChevronRight className="size-3" />
      </button>

      {currentDisplayRole !== "master_admin" && (
        <button 
          onClick={async () => {
            setLoading(true);
            await endTestMode();
            await refresh();
            window.location.href = "/dashboard";
          }}
          className="ml-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 px-2 py-1 bg-rose-500/10 rounded-full"
        >
          Exit Test Mode
        </button>
      )}
    </div>
  );
}
