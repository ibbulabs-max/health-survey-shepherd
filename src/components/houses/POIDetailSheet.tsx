import { MapPin, Navigation } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { mapConfig } from "@/config/map";
import type { HouseView } from "@/lib/domain";
import { getPinTypeConfig } from "@/config/pins";

export interface POIDetailSheetProps {
  poi: HouseView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function POIDetailSheet({ poi, open, onOpenChange }: POIDetailSheetProps) {
  if (!poi) return null;

  const pinType = (poi.house.pin_type || "shop").toLowerCase();
  const config = getPinTypeConfig(pinType);
  const title = poi.house.owner_name || poi.house.custom_type || config.label;
  const addressDisplay = poi.house.address ?? "No address recorded";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-lg mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl shadow-2xl">
        <div className="px-5 pb-8 pt-2 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* iOS Drag Handle */}
          <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />

          {/* POI Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block flex items-center gap-1.5">
                <div className="size-2 rounded-full" style={{ backgroundColor: config.color }} />
                Point of Interest
              </span>
              <h3 className="font-display font-bold text-xl text-foreground truncate mt-0.5">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{addressDisplay}</p>
            </div>
            
            <div className="size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
              <MapPin className="size-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-muted border border-border/50 text-xs">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Category</span>
                <span className="font-bold text-foreground">{config.label}</span>
              </div>
              
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Mapped By</span>
                <span className="font-bold text-foreground">{poi.house.mapped_by || "System"}</span>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="pt-2 border-t border-border/50">
            {poi.hasLocation ? (
              <a
                href={mapConfig.routeUrl(poi.house.latitude!, poi.house.longitude!)}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl border border-border bg-surface text-foreground font-semibold flex items-center justify-center gap-1.5 p-3 text-sm shadow-xs hover:bg-surface-muted transition-colors"
              >
                <Navigation className="size-4" /> Navigate to {config.label}
              </a>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
