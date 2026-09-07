import React from "react";
import { CandleRail } from "./CandleRail";
import { AnalyticsCandle } from "./AnalyticsCandle";
import type { DashboardWidget } from "@/hooks/useAnalyticsDashboard";

// Minimal set of props passed down from DashboardEngine to WidgetFactory
interface WidgetFactoryProps {
  widget: DashboardWidget;
  analyticsData: any; 
  filters: any;
  handleCandleClick: (key: string, val: string | number) => void;
  isCandleActive: (key: string, val: string | number) => boolean;
}

export function WidgetFactory({
  widget,
  analyticsData,
  filters,
  handleCandleClick,
  isCandleActive,
}: WidgetFactoryProps) {
  const { widget_type, config } = widget;
  
  // Custom Title overriding
  const title = config?.['title'] as string || getDefaultTitle(widget_type);
  
  switch (widget_type) {
    case "candle_gender": {
      const dist = analyticsData.genderDistribution || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.gender}
              label={d.gender || "Unknown"}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue" // Blueish
              isSelected={isCandleActive("gender", d.gender)}
              onClick={() => handleCandleClick("gender", d.gender)}
            />
          ))}
        </CandleRail>
      );
    }
    
    case "candle_age": {
      // Assuming binned data for simplicity if not passed in config
      const dist = analyticsData.ageDistributionBinned || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.ageGroup}
              label={d.ageGroup}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue" // Cyanish
              isSelected={isCandleActive("ageBinned", d.ageGroup)}
              onClick={() => handleCandleClick("ageBinned", d.ageGroup)}
            />
          ))}
        </CandleRail>
      );
    }
    
    case "candle_blood_sugar": {
      const dist = analyticsData.sugarDistribution || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} unit="mg/dL" hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.category}
              label={d.category}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue"
              isSelected={isCandleActive("bloodSugar", d.category)}
              onClick={() => handleCandleClick("bloodSugar", d.category)}
            />
          ))}
        </CandleRail>
      );
    }
    
    case "candle_bp_sys": {
      const dist = analyticsData.sysDistribution || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} unit="mmHg" hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.category}
              label={d.category}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue"
              isSelected={isCandleActive("sysBP", d.category)}
              onClick={() => handleCandleClick("sysBP", d.category)}
            />
          ))}
        </CandleRail>
      );
    }
    
    case "candle_bp_dia": {
      const dist = analyticsData.diaDistribution || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} unit="mmHg" hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.category}
              label={d.category}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue"
              isSelected={isCandleActive("diaBP", d.category)}
              onClick={() => handleCandleClick("diaBP", d.category)}
            />
          ))}
        </CandleRail>
      );
    }
    
    case "candle_bmi": {
      const dist = analyticsData.bmiDistribution || [];
      const max = Math.max(...dist.map((d: any) => d.count), 1);
      return (
        <CandleRail title={title} unit="kg/m²" hasData={dist.length > 0}>
          {dist.map((d: any) => (
            <AnalyticsCandle
              key={d.category}
              label={d.category}
              count={d.count}
              maxCount={max}
              totalCount={analyticsData.kpi?.totalMembers || 1}
              tone="blue"
              isSelected={isCandleActive("bmi", d.category)}
              onClick={() => handleCandleClick("bmi", d.category)}
            />
          ))}
        </CandleRail>
      );
    }

    default:
      return (
        <div className="bg-surface border border-border/70 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px] text-muted-foreground text-xs text-center">
          <p className="font-semibold mb-1 text-foreground">Unknown Widget</p>
          <p>Type: {widget_type}</p>
        </div>
      );
  }
}

function getDefaultTitle(type: string): string {
  switch (type) {
    case "candle_gender": return "Gender Distribution";
    case "candle_age": return "Age Distribution";
    case "candle_blood_sugar": return "Blood Sugar (RBS/FBS)";
    case "candle_bp_sys": return "Systolic BP";
    case "candle_bp_dia": return "Diastolic BP";
    case "candle_bmi": return "BMI Classifications";
    default: return "Custom Widget";
  }
}

function getRiskColor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("high") || cat.includes("elevated") || cat.includes("obese")) return "oklch(0.6 0.22 25)"; // Red
  if (cat.includes("moderate") || cat.includes("pre") || cat.includes("overweight")) return "oklch(0.7 0.16 60)"; // Orange
  if (cat.includes("normal") || cat.includes("healthy") || cat.includes("low")) return "oklch(0.65 0.18 150)"; // Green
  return "oklch(0.65 0.05 250)"; // Gray-blue
}
