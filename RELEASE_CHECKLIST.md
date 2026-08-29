# Release Checklist

## SMART IMPORT
- [x] Background job configured correctly
- [x] Lineage arrays correctly tracking `source_files`
- [x] Duplicate detection cascades properly
- [x] Rollback tested and working for erroneous imports

## FOLLOW-UP
- [x] 15/30/180 interval calculation matches spec exactly
- [x] Overdue tags display properly
- [x] Completion shifts to history and schedules next due date

## ANALYTICS
- [x] Candle visualizations match database rows
- [x] Member detail panel syncs properly
- [x] Drill-down clicks direct to Member Profile

## DATA QUALITY
- [x] Issues accurately capture missing vitals/demographics
- [x] "Fix" button directs to standalone Edit Flow

## MEMBER
- [x] Dedicated Member Summary page handles missing items gracefully
- [x] Edit Form saves directly into `data` JSONB object
- [x] Re-render triggers dataset update

## HOUSEHOLDS
- [x] Expandable bottom sheet works on mobile
- [x] Profile button next to Assess works

## REPORTS
- [x] XLSX generates three sheets with live filters applied
- [x] PDF generation uses correct header configuration

## USERS
- [x] Supervisor relationships restrict CHW view correctly
- [x] Admin can view all assigned

## MOBILE
- [x] Bottom navigation handles iPhone X safe area
- [x] Modals convert to Bottom Sheets
- [x] Tables don't break width

## DESKTOP
- [x] Grids properly utilize multi-column space
- [x] Modals remain centered

## UI/UX
- [x] Glassmorphism used on headers and fixed action bars
- [x] Semantic colors map to Risk Levels
- [x] Skeleton loading placeholders added for tables
- [x] Micro-interactions on buttons

## SECURITY & RLS
- [x] Supabase policies prevent cross-team deletion
- [x] `.env` correctly omitted from repo

## ACCESSIBILITY
- [x] Contrast ratios sufficient on Risk badges
- [x] Screen readers can read action buttons

## PERFORMANCE
- [x] TanStack query effectively deduplicates API requests
- [x] Large data exports handled asynchronously

## TESTING & BUILD
- [x] Playwright E2E passed
- [x] `npm run build` completed without errors
- [x] Git diff is clean and ready for release
