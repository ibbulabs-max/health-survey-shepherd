import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PIN_CATALOG } from "@/config/pins";
import { HouseIdBuilder } from "@/components/houses/HouseIdBuilder";
import { createStandalonePin, linkExistingHouseLocation } from "@/services/houseService";
import { useRefreshDataset } from "@/hooks/useDataset";
import { cn } from "@/lib/utils";

export interface PinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coords: { lat: number; lng: number; accuracy?: number | null } | null;
  existingHouseIds: string[];
  onRequestExistingPicker?: () => void;
  selectedExistingHouseUuid?: string | null;
  prefillAddress?: string;
  prefillType?: string;
}

export function PinSheet({
  open,
  onOpenChange,
  coords,
  existingHouseIds,
  onRequestExistingPicker,
  selectedExistingHouseUuid,
  prefillAddress = "",
  prefillType = "house",
}: PinSheetProps) {
  const refreshDataset = useRefreshDataset();
  
  const [pinDraftType, setPinDraftType] = useState<string>(prefillType);
  const [pinDraftAddress, setPinDraftAddress] = useState<string>(prefillAddress);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // House Builder Fields (used when Pin Type is House)
  const [draftBlock, setDraftBlock] = useState("B1");
  const [draftLane, setDraftLane] = useState("L1");
  const [draftSerialNo, setDraftSerialNo] = useState("001");
  const [draftHousingType, setDraftHousingType] = useState("Pakka");

  const handleSavePOI = async () => {
    if (!coords) return;
    setIsSavingPin(true);
    try {
      await createStandalonePin({
        pinType: pinDraftType,
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: coords.accuracy ?? null,
        address: pinDraftAddress || null,
      });
      toast.success("Map pin saved successfully.");
      onOpenChange(false);
      void refreshDataset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save map pin.");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSaveHouse = async () => {
    if (!coords) return;
    setIsSavingPin(true);
    try {
      if (selectedExistingHouseUuid) {
        await linkExistingHouseLocation({
          houseUuid: selectedExistingHouseUuid,
          pinType: pinDraftType,
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy ?? null,
          address: pinDraftAddress || null,
        });
        toast.success("Pin linked to existing household.");
      } else {
        const { buildCanonicalHouseId } = await import("@/services/houseService");
        const generatedHouseId = buildCanonicalHouseId(draftBlock, draftLane, draftSerialNo, draftHousingType);
        await createStandalonePin({
          pinType: pinDraftType,
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy ?? null,
          houseId: generatedHouseId,
        });
        toast.success("House mapped successfully.");
      }
      onOpenChange(false);
      void refreshDataset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save house pin.");
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl safe-bottom">
        <div className="px-5 pb-8 pt-2 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
          <DrawerHeader className="text-left px-0 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {selectedExistingHouseUuid ? "Link House Location" : "Place Map Pin"}
            </span>
            <DrawerTitle className="font-display text-lg font-bold mt-0.5">
              {selectedExistingHouseUuid ? "Link Existing House to Pin" : "Add Point of Interest Pin"}
            </DrawerTitle>
            {coords && (
              <DrawerDescription className="text-xs font-mono">
                Coordinates: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </DrawerDescription>
            )}
          </DrawerHeader>

          {/* Select from the 20 Pin Categories */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Pin Category</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border/50 rounded-2xl bg-surface-muted/40">
              {PIN_CATALOG.map((cat) => {
                const isSelected = pinDraftType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPinDraftType(cat.id)}
                    className={cn(
                      "p-2.5 rounded-xl border flex items-center gap-2 text-xs transition-all touch-target",
                      isSelected
                        ? "bg-primary text-white font-bold border-primary shadow-xs"
                        : "bg-surface text-foreground border-border/70 hover:bg-surface-muted"
                    )}
                  >
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? "white" : cat.color }}
                    />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline House ID Builder if House is selected */}
          {pinDraftType === "house" && !selectedExistingHouseUuid ? (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-foreground">New House ID</label>
                {onRequestExistingPicker && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onRequestExistingPicker();
                    }}
                    className="text-[10px] font-bold text-primary px-2 py-2 bg-primary/10 rounded-md touch-target"
                  >
                    Link Existing House Instead
                  </button>
                )}
              </div>
              <HouseIdBuilder
                existingHouseIds={existingHouseIds}
                block={draftBlock}
                lane={draftLane}
                serialNo={draftSerialNo}
                housingType={draftHousingType}
                onBlockChange={setDraftBlock}
                onLaneChange={setDraftLane}
                onSerialNoChange={setDraftSerialNo}
                onHousingTypeChange={setDraftHousingType}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Address / Landmark</label>
              <Input
                placeholder="e.g. Near Main Market, Block 4"
                value={pinDraftAddress}
                onChange={(e) => setPinDraftAddress(e.target.value)}
                className="h-11 rounded-xl text-xs touch-target"
              />
            </div>
          )}

          {/* Save Buttons */}
          <div className="pt-2 flex gap-2">
            {pinDraftType === "house" && !selectedExistingHouseUuid ? (
              <>
                <Button
                  type="button"
                  disabled={isSavingPin}
                  onClick={handleSaveHouse}
                  className="flex-1 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md touch-target h-12"
                >
                  {isSavingPin ? "Saving..." : "Save House Pin"}
                </Button>
              </>
            ) : pinDraftType === "house" && selectedExistingHouseUuid ? (
              <Button
                type="button"
                disabled={isSavingPin}
                onClick={handleSaveHouse}
                className="flex-1 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md touch-target h-12"
              >
                {isSavingPin ? "Linking..." : "Link House to Pin"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isSavingPin}
                onClick={handleSavePOI}
                className="flex-1 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md touch-target h-12"
              >
                {isSavingPin ? "Saving..." : "Save Point of Interest"}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
