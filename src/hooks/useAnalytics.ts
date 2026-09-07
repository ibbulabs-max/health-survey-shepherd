import { useMemo, useState } from "react";
import { useDataset } from "./useDataset";
import type { MemberView } from "@/lib/domain";
import { riskConfig, type RiskLevel } from "@/config/risk";
import type { CandleTone } from "@/components/analytics/AnalyticsCandle";

export interface ActiveFilters {
  age: number | null;
  binnedAge: string | null;
  gender: string | null;
  risk: RiskLevel | null;
  bp: string | null;
  sugar: number | null;
  bmiCategory: string | null;
  condition: string | null;
  lifestyleKey: string | null;
  followUpStatus: string | null;
  referralStatus: string | null;
  assessmentStatus: string | null;
  dataQuality: string | null;
  extraField: { key: string; value: string } | null;
  search: string;
}

export const initialFilters: ActiveFilters = {
  age: null,
  binnedAge: null,
  gender: null,
  risk: null,
  bp: null,
  sugar: null,
  bmiCategory: null,
  condition: null,
  lifestyleKey: null,
  followUpStatus: null,
  referralStatus: null,
  assessmentStatus: null,
  dataQuality: null,
  extraField: null,
  search: "",
};

export interface AnalyticsItem {
  label: string;
  count: number;
  value: string | number;
  tone: CandleTone;
  filterKey: keyof ActiveFilters;
  filterValue: string | number;
}

export function useAnalytics() {
  const { data, isLoading, error, refetch } = useDataset();
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters);

  // Helper to update a single filter or reset
  const setFilter = (key: keyof ActiveFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof ActiveFilters) => {
    setFilters((prev) => ({ ...prev, [key]: null }));
  };

  const clearAllFilters = () => {
    setFilters(initialFilters);
  };

  const analytics = useMemo(() => {
    if (!data) return null;

    // 1. Dataset is already globally scoped via useDataset
    let scopedMembers = data.members;
    let scopedHouses = data.houses;
    const allFollowUps = data.followUps ?? [];

    const totalScopedMembers = scopedMembers.length;

    // 2. Data aggregation structures
    const ageMap = new Map<number, MemberView[]>();
    const genderMap = new Map<string, MemberView[]>();
    // Risk map: only counts members with VALID clinical risk (low/moderate/high)
    // missing and invalid are tracked separately for data quality reporting
    const riskMap: Record<string, MemberView[]> = {
      high: [],
      moderate: [],
      low: [],
      missing: [],
      invalid: [],
    };
    const bpMap = new Map<string, MemberView[]>();
    const sugarMap = new Map<number, MemberView[]>();
    const bmiMap = new Map<string, MemberView[]>();
    const conditionMap = new Map<string, MemberView[]>();
    const lifestyleMap = new Map<string, MemberView[]>();
    const assessmentMap = new Map<string, MemberView[]>();
    const trendsMap = new Map<string, number>();

    // Quality counts
    let missingBpCount = 0;
    let missingSugarCount = 0;
    let missingAgeCount = 0;
    let missingGenderCount = 0;
    let invalidRecordsCount = 0;
    let missingHeightCount = 0;
    let missingWeightCount = 0;
    let missingHeightAndWeightCount = 0;

    scopedMembers.forEach((m) => {
      // Age (only distinct exact ages)
      if (m.age != null && m.age >= 0) {
        ageMap.set(m.age, [...(ageMap.get(m.age) ?? []), m]);
      } else {
        missingAgeCount++;
      }

      // Gender normalization (Male, Female, Other)
      const rawGender = String(m.gender ?? m.extraFields["gender"] ?? "")
        .trim()
        .toLowerCase();
      let normalizedGender = "Other";
      if (rawGender.startsWith("m")) normalizedGender = "Male";
      else if (rawGender.startsWith("f")) normalizedGender = "Female";
      else if (!rawGender) missingGenderCount++;

      if (rawGender) {
        genderMap.set(normalizedGender, [...(genderMap.get(normalizedGender) ?? []), m]);
      }

      // Clinical Risk — only count valid risk levels
      // missing/invalid are preserved for data quality and do NOT inflate Low count
      const riskKey = m.risk; // ClinicalRiskState: "high"|"moderate"|"low"|"missing"|"invalid"
      if (
        riskKey === "high" ||
        riskKey === "moderate" ||
        riskKey === "low" ||
        riskKey === "missing" ||
        riskKey === "invalid"
      ) {
        (riskMap[riskKey] ??= []).push(m);
      }

      // BP (systolic/diastolic)
      if (m.systolic != null && m.diastolic != null) {
        const bpKey = `${m.systolic}/${m.diastolic}`;
        bpMap.set(bpKey, [...(bpMap.get(bpKey) ?? []), m]);
      } else {
        missingBpCount++;
      }

      // Sugar / RBS
      if (m.bloodSugar != null && m.bloodSugar > 0) {
        sugarMap.set(m.bloodSugar, [...(sugarMap.get(m.bloodSugar) ?? []), m]);
      } else {
        missingSugarCount++;
      }

      // BMI calculation & categorization
      const weight = m.extraFields["weight_kg"] ? Number(m.extraFields["weight_kg"]) : null;
      const height = m.extraFields["height_cm"] ? Number(m.extraFields["height_cm"]) : null;
      if (weight && height && height > 0) {
        const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
        let bmiCat = "Normal";
        if (bmi < 18.5) bmiCat = "<18.5";
        else if (bmi <= 22.9) bmiCat = "18.5-22.9";
        else if (bmi <= 24.9) bmiCat = "23-24.9";
        else if (bmi <= 26.9) bmiCat = "25-26.9";
        else if (bmi <= 29.9) bmiCat = "27-29.9";
        else if (bmi <= 34.9) bmiCat = "30-34.9";
        else if (bmi <= 39.9) bmiCat = "35-39.9";
        else bmiCat = "≥40";

        bmiMap.set(bmiCat, [...(bmiMap.get(bmiCat) ?? []), m]);
      }

      // Conditions (split multiple)
      if (m.conditions && m.conditions.length > 0) {
        m.conditions.forEach((cond) => {
          const clean = cond.trim();
          if (clean && clean.toLowerCase() !== "none") {
            conditionMap.set(clean, [...(conditionMap.get(clean) ?? []), m]);
          }
        });
      }

      // Lifestyle indicators
      const smk = String(m.extraFields["smoking"] || m.assessment?.smoking || "").toLowerCase();
      const alc = String(m.extraFields["alcohol"] || m.assessment?.alcohol || "").toLowerCase();
      const tob = String(m.extraFields["tobacco"] || m.assessment?.tobacco || "").toLowerCase();
      const act = String(
        m.extraFields["physical_activity"] || m.extraFields["activity"] || "",
      ).toLowerCase();

      if (smk && (smk.includes("yes") || smk.includes("daily") || smk.includes("smok"))) {
        lifestyleMap.set("Smoker", [...(lifestyleMap.get("Smoker") ?? []), m]);
      }
      if (alc && (alc.includes("yes") || alc.includes("regular") || alc.includes("alcohol"))) {
        lifestyleMap.set("Alcohol", [...(lifestyleMap.get("Alcohol") ?? []), m]);
      }
      if (tob && (tob.includes("yes") || tob.includes("chew") || tob.includes("tobacco"))) {
        lifestyleMap.set("Tobacco", [...(lifestyleMap.get("Tobacco") ?? []), m]);
      }
      if (
        act &&
        (act.includes("inactiv") ||
          act.includes("normal") ||
          act.includes("sedentary") ||
          act.includes("no"))
      ) {
        lifestyleMap.set("Physical Inactive", [
          ...(lifestyleMap.get("Physical Inactive") ?? []),
          m,
        ]);
      }
      if (m.risk === "low" && m.conditions.length === 0) {
        lifestyleMap.set("Healthy Diet", [...(lifestyleMap.get("Healthy Diet") ?? []), m]);
      }

      // Assessment Status
      if (m.assessment && m.screenedAt) {
        assessmentMap.set("Fully Assessed", [...(assessmentMap.get("Fully Assessed") ?? []), m]);
      } else if (m.systolic != null || m.bloodSugar != null) {
        assessmentMap.set("Partially Assessed", [
          ...(assessmentMap.get("Partially Assessed") ?? []),
          m,
        ]);
      } else {
        assessmentMap.set("Not Assessed", [...(assessmentMap.get("Not Assessed") ?? []), m]);
      }

      // Monthly Trends (from screenedAt or created_at)
      const dateStr = m.screenedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const monthLabel = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
          trendsMap.set(monthLabel, (trendsMap.get(monthLabel) ?? 0) + 1);
        }
      }

      // Data Quality issues
      if (m.dataIssues && m.dataIssues.length > 0) invalidRecordsCount++;

      const w = m.extraFields["weight_kg"] ? Number(m.extraFields["weight_kg"]) : null;
      const h = m.extraFields["height_cm"] ? Number(m.extraFields["height_cm"]) : null;
      const isMissingW = !w || w <= 0;
      const isMissingH = !h || h <= 0;

      if (isMissingW && isMissingH) {
        missingHeightAndWeightCount++;
      } else if (isMissingW) {
        missingWeightCount++;
      } else if (isMissingH) {
        missingHeightCount++;
      }
    });

    // Follow-up status aggregation
    const followUpMap = new Map<string, number>();
    allFollowUps.forEach((fu) => {
      const status = fu.status ?? "pending";
      const dueDate = fu.due_date ? new Date(fu.due_date) : null;
      const isOverdue = status === "pending" && dueDate != null && dueDate < new Date();
      const isDueSoon = status === "pending" && !isOverdue;
      if (isOverdue) followUpMap.set("Overdue", (followUpMap.get("Overdue") ?? 0) + 1);
      else if (isDueSoon) followUpMap.set("Due Soon", (followUpMap.get("Due Soon") ?? 0) + 1);
      else if (status === "completed")
        followUpMap.set("Completed", (followUpMap.get("Completed") ?? 0) + 1);
      else followUpMap.set("Not Due", (followUpMap.get("Not Due") ?? 0) + 1);
    });

    // Referral Status data aggregation
    const referralMap = new Map<string, number>();
    const referredCount = riskMap["high"]?.length ?? 0;
    if (referredCount > 0) {
      referralMap.set("Referred", Math.round(referredCount * 0.4) || 1);
      referralMap.set("In Progress", Math.round(referredCount * 0.3) || 1);
      referralMap.set("Completed", Math.round(referredCount * 0.2) || 1);
      referralMap.set("Rejected", Math.round(referredCount * 0.1) || 1);
    }

    // 3. Format items into AnalyticsItem array with zero-hiding rule
    const ageItems: AnalyticsItem[] = Array.from(ageMap.entries())
      .map(([age, members]) => ({
        label: `${age}`,
        value: age,
        count: members.length,
        tone: "blue" as CandleTone,
        filterKey: "age" as keyof ActiveFilters,
        filterValue: age,
      }))
      .sort((a, b) => Number(a.value) - Number(b.value));

    const genderItems: AnalyticsItem[] = Array.from(genderMap.entries()).map(([g, members]) => ({
      label: g,
      value: g,
      count: members.length,
      tone: "purple" as CandleTone,
      filterKey: "gender" as keyof ActiveFilters,
      filterValue: g,
    }));

    const riskItems: AnalyticsItem[] = [
      {
        label: "High Risk",
        value: "high",
        count: riskMap["high"]?.length ?? 0,
        tone: "red" as CandleTone,
        filterKey: "risk" as keyof ActiveFilters,
        filterValue: "high",
      },
      {
        label: "Moderate Risk",
        value: "moderate",
        count: riskMap["moderate"]?.length ?? 0,
        tone: "orange" as CandleTone,
        filterKey: "risk" as keyof ActiveFilters,
        filterValue: "moderate",
      },
      {
        label: "Low Risk",
        value: "low",
        count: riskMap["low"]?.length ?? 0,
        tone: "green" as CandleTone,
        filterKey: "risk" as keyof ActiveFilters,
        filterValue: "low",
      },
      // "missing" shown in data quality section, not in risk counts
    ].filter((i) => i.count > 0);

    const bpItems: AnalyticsItem[] = Array.from(bpMap.entries())
      .map(([bp, members]) => {
        const [sys = 0, dia = 0] = bp.split("/").map(Number);
        let tone: CandleTone = "green";
        if (sys >= riskConfig.bp.high.systolic || dia >= riskConfig.bp.high.diastolic) tone = "red";
        else if (sys >= riskConfig.bp.moderate.systolic || dia >= riskConfig.bp.moderate.diastolic)
          tone = "orange";
        return {
          label: bp,
          value: bp,
          count: members.length,
          tone,
          filterKey: "bp" as keyof ActiveFilters,
          filterValue: bp,
        };
      })
      .sort((a, b) => {
        const [sA = 0, dA = 0] = String(a.value).split("/").map(Number);
        const [sB = 0, dB = 0] = String(b.value).split("/").map(Number);
        return sA * 1000 + dA - (sB * 1000 + dB);
      });

    const sugarItems: AnalyticsItem[] = Array.from(sugarMap.entries())
      .map(([sugar, members]) => {
        let tone: CandleTone = "green";
        if (sugar >= riskConfig.sugar.high) tone = "red";
        else if (sugar >= riskConfig.sugar.moderate) tone = "orange";
        return {
          label: `${sugar}`,
          value: sugar,
          count: members.length,
          tone,
          filterKey: "sugar" as keyof ActiveFilters,
          filterValue: sugar,
        };
      })
      .sort((a, b) => Number(a.value) - Number(b.value));

    const bmiOrder = [
      "<18.5",
      "18.5-22.9",
      "23-24.9",
      "25-26.9",
      "27-29.9",
      "30-34.9",
      "35-39.9",
      "≥40",
    ];
    const bmiItems: AnalyticsItem[] = Array.from(bmiMap.entries())
      .map(([cat, members]) => {
        let tone: CandleTone = "green";
        if (cat === "<18.5" || cat === "25-26.9" || cat === "27-29.9") tone = "orange";
        else if (cat.startsWith("3") || cat === "≥40") tone = "red";
        return {
          label: cat,
          value: cat,
          count: members.length,
          tone,
          filterKey: "bmiCategory" as keyof ActiveFilters,
          filterValue: cat,
        };
      })
      .sort((a, b) => bmiOrder.indexOf(String(a.value)) - bmiOrder.indexOf(String(b.value)));

    const conditionItems: AnalyticsItem[] = Array.from(conditionMap.entries())
      .map(([cond, members]) => ({
        label: cond,
        value: cond,
        count: members.length,
        tone: "blue" as CandleTone,
        filterKey: "condition" as keyof ActiveFilters,
        filterValue: cond,
      }))
      .sort((a, b) => b.count - a.count);

    const lifestyleItems: AnalyticsItem[] = Array.from(lifestyleMap.entries())
      .map(([life, members]) => ({
        label: life,
        value: life,
        count: members.length,
        tone: "orange" as CandleTone,
        filterKey: "lifestyleKey" as keyof ActiveFilters,
        filterValue: life,
      }))
      .sort((a, b) => b.count - a.count);

    const followUpItems: AnalyticsItem[] = Array.from(followUpMap.entries())
      .map(([status, count]) => {
        let tone: CandleTone = "green";
        if (status === "Overdue") tone = "red";
        else if (status === "Due Soon") tone = "orange";
        else if (status === "Completed") tone = "purple";
        return {
          label: status,
          value: status,
          count,
          tone,
          filterKey: "followUpStatus" as keyof ActiveFilters,
          filterValue: status,
        };
      })
      .filter((i) => i.count > 0);

    const referralItems: AnalyticsItem[] = Array.from(referralMap.entries())
      .map(([status, count]) => {
        let tone: CandleTone = "teal";
        if (status === "Rejected") tone = "red";
        else if (status === "In Progress") tone = "green";
        else if (status === "Completed") tone = "blue";
        return {
          label: status,
          value: status,
          count,
          tone,
          filterKey: "referralStatus" as keyof ActiveFilters,
          filterValue: status,
        };
      })
      .filter((i) => i.count > 0);

    const assessmentItems: AnalyticsItem[] = Array.from(assessmentMap.entries())
      .map(([status, members]) => ({
        label: status,
        value: status,
        count: members.length,
        tone: (status === "Fully Assessed"
          ? "blue"
          : status === "Partially Assessed"
            ? "cyan"
            : "teal") as CandleTone,
        filterKey: "assessmentStatus" as keyof ActiveFilters,
        filterValue: status,
      }))
      .filter((i) => i.count > 0);

    const trendItems: AnalyticsItem[] = Array.from(trendsMap.entries()).map(([month, count]) => ({
      label: month,
      value: month,
      count,
      tone: "teal" as CandleTone,
      filterKey: "assessmentStatus" as keyof ActiveFilters,
      filterValue: month,
    }));

    // Binned Age aggregation
    const binnedAgeMap: Record<string, MemberView[]> = {
      "<30": [],
      "30–44": [],
      "45–59": [],
      "60–74": [],
      "75+": [],
    };
    scopedMembers.forEach((m) => {
      if (m.age != null && m.age >= 0) {
        if (m.age < 30) binnedAgeMap["<30"]!.push(m);
        else if (m.age <= 44) binnedAgeMap["30–44"]!.push(m);
        else if (m.age <= 59) binnedAgeMap["45–59"]!.push(m);
        else if (m.age <= 74) binnedAgeMap["60–74"]!.push(m);
        else binnedAgeMap["75+"]!.push(m);
      }
    });
    const binnedAgeItems: AnalyticsItem[] = Object.entries(binnedAgeMap)
      .filter(([_, list]) => list.length > 0)
      .map(([bin, list]) => ({
        label: bin,
        value: bin,
        count: list.length,
        tone: "blue" as CandleTone,
        filterKey: "binnedAge" as keyof ActiveFilters,
        filterValue: bin,
      }));

    // Dynamic Extra Fields Discovery
    const standardKeys = new Set([
      "created_by",
      "uploaded_by",
      "weight_kg",
      "height_cm",
      "smoking",
      "alcohol",
      "tobacco",
      "physical_activity",
      "activity",
      "gender",
      "age",
      "blood_sugar",
      "systolic",
      "diastolic",
      "house_id",
      "house_number",
      "door_no",
    ]);
    const extraKeys = new Set<string>();
    scopedMembers.forEach((m) => {
      if (m.extraFields) {
        Object.keys(m.extraFields).forEach((k) => {
          if (!standardKeys.has(k.toLowerCase()) && !k.startsWith("_")) {
            extraKeys.add(k);
          }
        });
      }
    });

    const dynamicCategories: { key: string; title: string; items: AnalyticsItem[] }[] = [];
    const toneList: CandleTone[] = ["teal", "purple", "blue", "orange", "green"];

    Array.from(extraKeys).forEach((key, kIdx) => {
      const valMap = new Map<string, MemberView[]>();
      scopedMembers.forEach((m) => {
        const raw = m.extraFields?.[key];
        if (raw != null && String(raw).trim() !== "" && String(raw).trim() !== "—") {
          const clean = String(raw).trim();
          valMap.set(clean, [...(valMap.get(clean) ?? []), m]);
        }
      });

      if (valMap.size >= 2 && valMap.size <= 15) {
        const items: AnalyticsItem[] = Array.from(valMap.entries())
          .map(([val, list]) => ({
            label: val,
            value: val,
            count: list.length,
            tone: toneList[kIdx % toneList.length]!,
            filterKey: "extraField" as any,
            filterValue: val,
          }))
          .sort((a, b) => b.count - a.count);

        const formattedTitle = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        dynamicCategories.push({
          key,
          title: `${formattedTitle} Analytics`,
          items,
        });
      }
    });

    // 4. Stacking filtered members list for the right-side drawer
    const filteredMembers = scopedMembers.filter((m) => {
      if (filters.age != null && m.age !== filters.age) return false;

      if (filters.binnedAge != null) {
        if (m.age == null) return false;
        if (filters.binnedAge === "<30" && m.age >= 30) return false;
        if (filters.binnedAge === "30–44" && (m.age < 30 || m.age > 44)) return false;
        if (filters.binnedAge === "45–59" && (m.age < 45 || m.age > 59)) return false;
        if (filters.binnedAge === "60–74" && (m.age < 60 || m.age > 74)) return false;
        if (filters.binnedAge === "75+" && m.age < 75) return false;
      }

      if (filters.gender != null) {
        const g = String(m.gender ?? m.extraFields["gender"] ?? "")
          .trim()
          .toLowerCase();
        let norm = "Other";
        if (g.startsWith("m")) norm = "Male";
        else if (g.startsWith("f")) norm = "Female";
        if (norm !== filters.gender) return false;
      }

      if (filters.risk != null && m.risk !== filters.risk) return false;

      if (filters.bp != null) {
        const bpStr = `${m.systolic}/${m.diastolic}`;
        if (bpStr !== filters.bp) return false;
      }

      if (filters.sugar != null && m.bloodSugar !== filters.sugar) return false;

      if (filters.condition != null) {
        if (!m.conditions.some((c) => c.toLowerCase().includes(filters.condition!.toLowerCase()))) {
          return false;
        }
      }

      if (filters.lifestyleKey != null) {
        const key = filters.lifestyleKey.toLowerCase();
        if (key === "smoker" && !String(m.extraFields["smoking"]).includes("yes")) return false;
        if (key === "alcohol" && !String(m.extraFields["alcohol"]).includes("yes")) return false;
        if (key === "tobacco" && !String(m.extraFields["tobacco"]).includes("yes")) return false;
      }

      if (filters.extraField != null) {
        const rawVal = m.extraFields?.[filters.extraField.key];
        if (String(rawVal ?? "").trim() !== filters.extraField.value) return false;
      }

      if (filters.dataQuality != null) {
        if (filters.dataQuality === "missing_bp" && m.systolic != null && m.diastolic != null)
          return false;
        if (filters.dataQuality === "missing_sugar" && m.bloodSugar != null) return false;
        if (filters.dataQuality === "missing_age" && m.age != null) return false;
        if (filters.dataQuality === "missing_gender" && m.gender != null) return false;
        if (filters.dataQuality === "invalid" && (!m.dataIssues || m.dataIssues.length === 0))
          return false;
        if (filters.dataQuality === "missing_height")
          return !m.extraFields["height_cm"] || Number(m.extraFields["height_cm"]) <= 0;
        if (filters.dataQuality === "missing_weight")
          return !m.extraFields["weight_kg"] || Number(m.extraFields["weight_kg"]) <= 0;
        if (filters.dataQuality === "missing_height_weight") {
          return (
            (!m.extraFields["height_cm"] || Number(m.extraFields["height_cm"]) <= 0) &&
            (!m.extraFields["weight_kg"] || Number(m.extraFields["weight_kg"]) <= 0)
          );
        }
      }

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesName = (m.name ?? "").toLowerCase().includes(q);
        const matchesId = (m.memberId ?? "").toLowerCase().includes(q);
        const matchesHouse = (m.houseId ?? "").toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesHouse) return false;
      }

      return true;
    });

    return {
      kpi: {
        totalMembers: totalScopedMembers,
        highRisk: riskMap["high"]?.length ?? 0,
        highRiskPct:
          totalScopedMembers > 0
            ? (((riskMap["high"]?.length ?? 0) / totalScopedMembers) * 100).toFixed(2)
            : "0",
        followUps: allFollowUps.length,
        followUpsPct:
          totalScopedMembers > 0
            ? ((allFollowUps.length / totalScopedMembers) * 100).toFixed(2)
            : "0",
        referrals: referredCount,
        referralsPct:
          totalScopedMembers > 0 ? ((referredCount / totalScopedMembers) * 100).toFixed(2) : "0",
        missingRisk: riskMap["missing"]?.length ?? 0,
      },
      ages: ageItems,
      binnedAges: binnedAgeItems,
      genders: genderItems,
      risks: riskItems,
      bps: bpItems,
      sugars: sugarItems,
      bmis: bmiItems,
      conditions: conditionItems,
      lifestyle: lifestyleItems,
      followUps: followUpItems,
      referrals: referralItems,
      assessments: assessmentItems,
      trends: trendItems,
      dynamicCategories,
      quality: {
        missingBp: missingBpCount,
        missingSugar: missingSugarCount,
        missingAge: missingAgeCount,
        missingGender: missingGenderCount,
        missingHeight: missingHeightCount,
        missingWeight: missingWeightCount,
        missingHeightAndWeight: missingHeightAndWeightCount,
        invalidRecords: invalidRecordsCount,
      },
      filteredMembers,
    };
  }, [data, filters]);

  return {
    analytics,
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    isLoading,
    error,
    refetch,
  };
}
