---
name: performance-optimization
description: >-
  Performance optimization guidelines for React/Vite frontends, TanStack query caching, bundle size,
  and PostgreSQL database indexing and query tuning. Use when diagnosing slow renders, high page load times,
  heavy bundle sizes, or database query bottlenecks.
---

# Application & Database Performance Optimization Skill

## Core Guidelines

### 1. Frontend Performance
- **Bundle Splitting**: Lazy load heavy routes and non-critical components using dynamic `import()` or TanStack Router lazy routes.
- **Render Optimization**: Avoid unnecessary re-renders with `useMemo`, `useCallback`, or memoized selectors for large datasets.
- **Asset Optimization**: Serve images in modern formats (WebP/AVIF) with appropriate `srcset` and responsive sizes.
- **Tree-Shaking**: Import icons and utility libraries selectively (e.g. `import { Check } from 'lucide-react'`).

### 2. Database & Supabase Performance
- **Index Foreign Keys**: Ensure all foreign key columns have indexes to accelerate JOIN operations.
- **Optimize RLS Policies**: Avoid subqueries inside `USING` policies where possible; index foreign columns used inside RLS conditions (`auth.uid()`).
- **Pagination**: Use cursor-based or range-based pagination (`.range(start, end)`) for large datasets instead of fetching unbounded rows.
- **Query Optimization**: Use `EXPLAIN ANALYZE` on complex queries to detect sequential scans and missing indexes.
