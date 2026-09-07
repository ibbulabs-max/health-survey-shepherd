const fs = require("fs");
const file =
  "c:/Users/pc/OneDrive/Documents/Desktop/v3/health-survey-shepherd-main/src/routes/_authenticated/map.tsx";
let content = fs.readFileSync(file, "utf8");

// 1. Add Import
content = content.replace(
  'import { GlobalFilterSheet } from "@/components/common/GlobalFilterSheet";',
  'import { GlobalFilterSheet } from "@/components/common/GlobalFilterSheet";\nimport { PinFormSheet, type PinDraft } from "@/components/map/PinFormSheet";',
);

// 2. Add formOpen state
content = content.replace(
  "const [placing, setPlacing] = useState(false);",
  "const [placing, setPlacing] = useState(false);\n  const [formOpen, setFormOpen] = useState(false);",
);

// 3. Add houseMatches logic
content = content.replace(
  "const [houseOpen, setHouseOpen] = useState(false);",
  "const [houseOpen, setHouseOpen] = useState(false);\n  const houseMatches = useMemo(() => {\n    if (!houseTerm.trim()) return [];\n    const q = houseTerm.trim().toLowerCase();\n    return houses.filter(h => {\n      const matchHouse = h.house.house_id?.toLowerCase().includes(q) || h.house.house_number?.toLowerCase().includes(q) || h.house.owner_name?.toLowerCase().includes(q);\n      const matchMember = h.members.some(m => m.name?.toLowerCase().includes(q));\n      return matchHouse || matchMember;\n    });\n  }, [houses, houseTerm]);",
);

// 4. Update handleTap to use formOpen
content = content.replace(
  'setPlacing(true);\n      setNewPinType("house");',
  "setPlacing(true);\n      setFormOpen(true);",
);

// 5. Replace confirmNewPin to use draft
content = content.replace(
  /async function confirmNewPin\(\) \{[\s\S]*?finally \{\s*setSavingHouse\(false\);\s*\}\s*\}/,
  `async function confirmNewPin(pinDraft: PinDraft) {
    if (!draft) return;
    setSavingHouse(true);
    try {
      const { error } = await supabase.from("houses").insert({
        house_id: pinDraft.house_id || \`PIN-\${Math.floor(Math.random() * 10000)}\`,
        latitude: pinDraft.latitude,
        longitude: pinDraft.longitude,
        accuracy: pinDraft.accuracy,
        pin_type: pinDraft.pin_type,
        custom_type: pinDraft.custom_type,
        house_number: pinDraft.house_number,
        owner_name: pinDraft.owner_name,
        address: pinDraft.notes || "Added from Map",
        mapped_by: user?.userId,
      });

      if (error) throw error;

      toast.success("Pin created");
      setPlacing(false);
      setFormOpen(false);
      setDraft(null);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingHouse(false);
    }
  }`,
);

// 6. Replace placing div block with PinFormSheet trigger overlay
content = content.replace(
  /\{\s*placing \? \([\s\S]*?Save Pin\s*<\/button>\s*<\/div>\s*\)\s*:\s*null\s*\}/,
  `{placing && !formOpen ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <p className="text-[13px] font-medium text-foreground">Tap the map to place your pin</p>
            <button
              type="button"
              onClick={() => {
                setPlacing(false);
                setDraft(null);
              }}
              className="press grid size-7 place-items-center rounded-full bg-card/70 border border-border"
              aria-label="Exit add pin mode"
            >
              <X className="size-4 text-foreground" />
            </button>
          </div>
        ) : null}`,
);

// Add PinFormSheet at the very end of the file before last div closure
content = content.replace(
  /\{activeHouse && \([\s\S]*?<\/div>\s*\)\;\s*\}\s*$/,
  `{activeHouse && (
        <HouseDetailSheet
          house={activeHouse}
          open={!!activeHouse}
          onOpenChange={(o) => !o && setActiveHouse(null)}
          onAddLocation={startHouseLocation}
        />
      )}
      <PinFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (open) setFormOpen(true);
          else {
             setFormOpen(false);
             setPlacing(false);
             setDraft(null);
          }
        }}
        coords={draft}
        accuracy={position?.accuracy ?? null}
        saving={savingHouse}
        onSave={confirmNewPin}
      />
    </div>
  );
}`,
);

// 7. Counters Block
// Find the closing of filters div and inject counters
content = content.replace(
  /<div className="grid grid-cols-2 gap-1\.5">[\s\S]*?<\/div>\s*<\/div>\s*\)\s*:\s*null\s*\}\s*<\/div>/,
  (match) =>
    match +
    `
        <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-3 py-2 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
          <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {types.length > 0 || houseTerm.trim() ? "Filtered data" : "All data"}
          </p>
          <div className="grid grid-cols-6 gap-1 text-center">
            {[
              ["Houses", countOf(pins, "house")],
              ["Shops", countOf(pins, "shop")],
              ["Locked", countOf(pins, "locked_house")],
              ["Refused", countOf(pins, "refused")],
              ["Land", countOf(pins, "empty_land")],
              ["Total", pins.length],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-[13px] font-semibold text-foreground">{value}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>`,
);

// 8. Search input matches dropdown
content = content.replace(
  /<div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-3 py-2\.5 bg-background\/80 backdrop-blur-xl border border-white\/40 shadow-sm">\s*<div className="flex items-center gap-2">[\s\S]*?className="w-full bg-transparent text-\[13px\] outline-none text-foreground placeholder:text-muted-foreground"\s*\/>\s*<\/div>\s*<\/div>/,
  (match) =>
    match
      .replace(
        "onChange={(e) => {\n                setHouseTerm(e.target.value);\n              }}",
        "onChange={(e) => {\n                setHouseTerm(e.target.value);\n                setHouseOpen(true);\n              }}",
      )
      .replace(
        "</div>\n        </div>",
        `</div>
          {houseOpen && houseMatches.length > 0 ? (
            <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {houseMatches.slice(0, 20).map((h) => (
                <button
                  key={h.house.id}
                  type="button"
                  onClick={() => {
                    setHouseOpen(false);
                    setHouseTerm("");
                    setActiveHouse(h);
                    if (h.hasLocation && h.house.latitude !== null && h.house.longitude !== null) {
                      setFocus({ lat: h.house.latitude, lng: h.house.longitude });
                    }
                  }}
                  className="press flex w-full items-center justify-between gap-2 rounded-xl bg-card/70 px-3 py-2 text-left border border-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-foreground">{h.house.house_id}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      House No. {h.house.house_number || "—"} · {h.members?.length ?? 0} members
                    </span>
                  </span>
                  <span
                    className={\`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold \${
                      !h.hasLocation || h.house.latitude === null ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
                    }\`}
                  >
                    {!h.hasLocation || h.house.latitude === null ? "Not mapped" : "Mapped"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {houseOpen && houseTerm.trim() && !houseMatches.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">No matching house found.</p>
          ) : null}
        </div>`,
      ),
);

fs.writeFileSync(file, content);
console.log("map.tsx patched successfully");
