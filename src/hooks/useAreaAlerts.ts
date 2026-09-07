import { useEffect, useRef, useState } from "react";
import { supabase } from "@/db/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

export function useAreaAlerts() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const [areas, setAreas] = useState<any[]>([]);
  const lastAlertTime = useRef<number>(0);
  
  useEffect(() => {
    if (!user || user.actualRole !== "survey_user") return;

    // Load assigned areas for this CHW
    const fetchAreas = async () => {
      const { data } = await supabase
        .from("map_areas")
        .select("*")
        .eq("assigned_chw_id", user.id);
      
      if (data) {
        setAreas(data);
      }
    };
    
    fetchAreas();
  }, [user]);

  useEffect(() => {
    if (!position || !user || areas.length === 0) return;

    // Check if we have privacy settings enabled
    const checkPrivacy = async () => {
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("gps_sharing_enabled")
        .eq("user_id", user.id)
        .single();
        
      if (!userSettings?.gps_sharing_enabled) return;

      const { data: globalSettings } = await supabase
        .from("global_settings")
        .select("working_day_start, working_day_end, working_hours_enabled")
        .eq("singleton_key", true)
        .single();
        
      if (globalSettings?.working_hours_enabled === false) return;

      const startHour = parseInt((globalSettings?.working_day_start || "08:00").split(":")[0], 10);
      const endHour = parseInt((globalSettings?.working_day_end || "18:00").split(":")[0], 10);

      // Check working hours
      const hour = new Date().getHours();
      if (hour < startHour || hour >= endHour) return;

      // Rate limit alerts to once every 15 minutes
      const now = Date.now();
      if (now - lastAlertTime.current < 15 * 60 * 1000) return;

      try {
        const pt = turf.point([position.lng, position.lat]);
        let isInsideAny = false;

        for (const area of areas) {
          if (area.geometry && (area.geometry.type === "Polygon" || area.geometry.type === "MultiPolygon")) {
            const poly = area.geometry as Feature<Polygon | MultiPolygon>;
            if (turf.booleanPointInPolygon(pt, poly.geometry ? poly.geometry : poly as any)) {
              isInsideAny = true;
              break;
            }
          }
        }

        if (!isInsideAny) {
          // Out of bounds alert
          await supabase.from("system_alerts").insert({
            category: "GEOFENCE_VIOLATION",
            severity: "warning",
            summary: `CHW ${user.email || user.id} is outside of assigned working areas.`,
            details: {
              userId: user.id,
              location: { lat: position.lat, lng: position.lng },
              timestamp: new Date().toISOString()
            }
          });
          lastAlertTime.current = now;
        }
      } catch (err) {
        console.error("Error checking geofence:", err);
      }
    };

    checkPrivacy();
  }, [position, user, areas]);
}
