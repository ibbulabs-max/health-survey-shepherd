import { useState, useEffect } from "react";
import { Plus, Check, Home, Building2, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getAvailableBlocks,
  getAvailableLanes,
  saveCustomBlock,
  saveCustomLane,
  calculateNextSerial,
  buildCanonicalHouseId,
} from "@/services/houseService";
import { cn } from "@/lib/utils";

export interface HouseIdBuilderProps {
  existingHouseIds: string[];
  block: string;
  lane: string;
  serialNo: string;
  housingType: string;
  onBlockChange: (block: string) => void;
  onLaneChange: (lane: string) => void;
  onSerialNoChange: (serialNo: string) => void;
  onHousingTypeChange: (type: string) => void;
}

export function HouseIdBuilder({
  existingHouseIds,
  block,
  lane,
  serialNo,
  housingType,
  onBlockChange,
  onLaneChange,
  onSerialNoChange,
  onHousingTypeChange,
}: HouseIdBuilderProps) {
  const [blocks, setBlocks] = useState<string[]>(() => getAvailableBlocks(existingHouseIds));
  const [lanes, setLanes] = useState<string[]>(() => getAvailableLanes(existingHouseIds));

  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [newBlockInput, setNewBlockInput] = useState("");

  const [addLaneOpen, setAddLaneOpen] = useState(false);
  const [newLaneInput, setNewLaneInput] = useState("");

  // When block or lane changes, automatically determine the next available serial number
  useEffect(() => {
    if (block && lane) {
      const next = calculateNextSerial(existingHouseIds, block, lane);
      onSerialNoChange(next);
    }
  }, [block, lane, existingHouseIds]);

  const handleAddBlock = () => {
    const clean = newBlockInput.trim().toUpperCase();
    if (!clean) return;
    saveCustomBlock(clean);
    setBlocks(getAvailableBlocks(existingHouseIds));
    onBlockChange(clean);
    setNewBlockInput("");
    setAddBlockOpen(false);
  };

  const handleAddLane = () => {
    const clean = newLaneInput.trim().toUpperCase();
    if (!clean) return;
    saveCustomLane(clean);
    setLanes(getAvailableLanes(existingHouseIds));
    onLaneChange(clean);
    setNewLaneInput("");
    setAddLaneOpen(false);
  };

  const houseIdPreview = buildCanonicalHouseId(block, lane, serialNo, housingType);

  const housingTypes = [
    { id: "Pakka", label: "Pakka", code: "P", desc: "Concrete/brick" },
    { id: "Semi-Pakka", label: "Semi-Pakka", code: "SP", desc: "Mixed construction" },
    { id: "Kachcha", label: "Kachcha", code: "K", desc: "Mud/thatch/temporary" },
  ];

  return (
    <div className="space-y-6">
      {/* Live iOS House ID Card Preview */}
      <div className="card-surface ios-glass p-4 rounded-2xl border border-primary/20 bg-primary-soft/30 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Canonical House ID
          </span>
          <p className="font-display font-bold text-2xl text-foreground tracking-tight mt-0.5">
            {houseIdPreview}
          </p>
        </div>
        <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
          <Home className="size-5" />
        </div>
      </div>

      {/* Block Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Block Number
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAddBlockOpen(true)}
            className="h-7 text-xs text-primary hover:text-primary font-medium px-2 rounded-lg"
          >
            <Plus className="size-3.5 mr-1" /> Add Block
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {blocks.map((b) => {
            const active = block === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => onBlockChange(b)}
                className={cn(
                  "min-w-[56px] py-2.5 px-3 rounded-xl font-display font-semibold text-sm transition-all text-center border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted",
                )}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lane Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Lane Number
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAddLaneOpen(true)}
            className="h-7 text-xs text-primary hover:text-primary font-medium px-2 rounded-lg"
          >
            <Plus className="size-3.5 mr-1" /> Add Lane
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {lanes.map((l) => {
            const active = lane === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => onLaneChange(l)}
                className={cn(
                  "min-w-[56px] py-2.5 px-3 rounded-xl font-display font-semibold text-sm transition-all text-center border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted",
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Serial Number (Auto-calculated with Manual override) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Serial Number
          </Label>
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Auto-calculated
          </span>
        </div>
        <Input
          value={serialNo}
          onChange={(e) => onSerialNoChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="001"
          maxLength={4}
          className="h-12 rounded-xl text-lg font-mono font-bold tracking-widest text-center"
        />
        <p className="text-[11px] text-muted-foreground">
          Automatically assigned for {block} + {lane}. Prevents duplicate House IDs.
        </p>
      </div>

      {/* Housing Type Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Housing Type
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {housingTypes.map((ht) => {
            const active = housingType === ht.id;
            return (
              <button
                key={ht.id}
                type="button"
                onClick={() => onHousingTypeChange(ht.id)}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all flex flex-col justify-between relative",
                  active
                    ? "bg-primary/10 border-primary text-primary shadow-sm ring-2 ring-primary/20"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted",
                )}
              >
                {active && (
                  <div className="absolute top-2 right-2 size-4 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                )}
                <div>
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-muted inline-block mb-1">
                    {ht.code}
                  </span>
                  <p className="font-semibold text-sm text-foreground">{ht.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{ht.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Custom Block Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Block</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">
              Block Identifier (e.g. B11, B12)
            </Label>
            <Input
              value={newBlockInput}
              onChange={(e) => setNewBlockInput(e.target.value)}
              placeholder="B11"
              className="mt-1.5 rounded-xl font-bold uppercase"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setAddBlockOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAddBlock}
              disabled={!newBlockInput.trim()}
              className="rounded-xl"
            >
              Add Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Lane Dialog */}
      <Dialog open={addLaneOpen} onOpenChange={setAddLaneOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add New Lane</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Lane Identifier (e.g. L11, L12)</Label>
            <Input
              value={newLaneInput}
              onChange={(e) => setNewLaneInput(e.target.value)}
              placeholder="L11"
              className="mt-1.5 rounded-xl font-bold uppercase"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setAddLaneOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleAddLane} disabled={!newLaneInput.trim()} className="rounded-xl">
              Add Lane
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
