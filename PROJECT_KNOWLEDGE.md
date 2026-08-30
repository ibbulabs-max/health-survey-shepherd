# Project Knowledge Base

## Architecture Overview

The application is a modern React web application built with **React Router (v7 / TanStack Router)** and **Vite**, backed by **Supabase** (PostgreSQL). It acts as a comprehensive Health Survey Management system.

### Core Stack

- **Frontend Framework**: React 19 + Vite (SSR/SSG capable).
- **Routing**: TanStack Router (file-based routing with loaders).
- **Styling**: Tailwind CSS v4 with native `@theme inline` definition (using `oklch` for rich colors) + shadcn/ui components (Radix UI primitives).
- **Database/Auth**: Supabase (Auth, RLS, Edge Functions, pg_vector if needed).
- **Icons**: Lucide React.
- **Date Handling**: Native Date API with `date-fns` for precise working day and holiday math.
- **Data Fetching**: TanStack Query / React Query for mutations and caching.
- **Animations**: Framer Motion for iOS-style liquid navigation, sheets, and micro-interactions.

## Routes & Structure

- `/` - Landing / Login page (bypassed in dev QA mode).
- `/_authenticated` - Protected layout wrap (`AppShell.tsx`).
- `/_authenticated/dashboard` - Main home view, dynamically switches by role.
- `/_authenticated/followups` - Continuous health monitoring loop tracking.
- `/_authenticated/map` - Geospatial house mapping.
- `/_authenticated/survey/new` - Quick action to add a new assessment.
- `/_authenticated/members/$memberId` - Individual member view.
- `/_authenticated/settings` - Preferences, imports, configuration.

## Roles and Permissions

The system supports three strict roles governed by Supabase RLS and React route protection:

1. **Admin (`admin`)**: Complete system access, oversees QA setup, team management, and global configuration.
2. **Supervisor (`supervisor`)**: Manages CHW workflows, reviews pending imported data, handles escalations.
3. **CHW (`survey_user`)**: Field operative performing surveys. Accesses Smart Import (under the 'More' menu on mobile) and records basic screening details. Cannot access Admin/Supervisor settings.

## Follow-up & Date Logic

The Follow-up system handles the continuous health monitoring loop:

- **Eligibility**: Strictly `age >= 30`. Checked at the database extraction layer and service insertion layer.
- **Risk Intervals**:
  - `High` Risk = +15 days.
  - `Moderate` Risk = +30 days.
  - `Normal` Risk = +180 days.
- **Date Projection Logic**: Base Date relies on the _Follow-up Count (History)_. `Next Due Date = Base Assessment Date + (Count * Risk Interval)`.
- **Working Day enforcement**: Follow-ups landing on weekends or defined holidays are safely pushed to the next available working day using robust logic without timezone midnight boundary bugs.
- **Continuous Loop**:
  Current Active Follow-up -> Click Complete -> Show Vitals Dialog -> Save Vitals -> Previous Follow-up is marked 'completed' (history preserved) -> Risk is recalculated based on new vitals -> EXACTLY ONE Next Pending Follow-up is generated -> UI Refreshes.

## UI/UX & Design System (Liquid Glass)

The design prioritizes a high-fidelity 2025/2026 iOS-inspired Liquid Glass aesthetic:

- **Liquid Glass System**: Custom CSS utilities (`ios-glass`, `ios-glass-panel`, `ios-glass-button`) with deep `backdrop-filter: blur(24px)`, `color-mix` translucency, and soft inset borders.
- **Mobile UX**: Distinct rendering tree. Floating Liquid Glass bottom tab navigation with Framer Motion layout animations. Touch-friendly sheets instead of dropdowns. Follow-up dates stacked securely.
- **Desktop UX**: Separated from mobile. Uses a static sidebar navigation tree with hover interactions. Follow-up cards use a grid layout.
- **Animations System**: Built on `framer-motion` for shared layout IDs, spring transitions, scale tap effects, and staggered list entrances. Always respects `prefers-reduced-motion`.
- **Card Responsiveness**: Dates and critical data are mapped explicitly (Assessment Date, Last Follow-up, Next Follow-up) and truncated carefully to prevent clipping or layout breaking.

## Features & Subsystems

- **Smart Import**: Supports CSV/Excel data ingestion. Validates schema, maps fields, and handles conflict resolution. Available to Admins, Supervisors, and CHWs (`survey_user` explicitly granted `import_data` permission).
- **QA Architecture**: Zero-friction local development QA. `VITE_QA_ROLE` and `localStorage.getItem("QA_ROLE")` automatically authenticate a test user (Admin, Supervisor, or CHW) using a real Supabase session, ensuring RLS and permissions are actively tested without manual browser login. _This is strictly disabled in production._

## Testing Strategy

- **Manual / Visual QA**: Render inspection and responsive layout validation across mobile (375px/390px) and desktop (1366px+) breakpoints.
- **Functional QA**: Verify role isolation, Follow-up progression (cycle completion to next pending), and Smart Import workflows.
- **Build QA**: `npx tsc --noEmit` and `vite build` ensure TypeScript correctness and bundle safety.

## Completed Features

- iOS Liquid Glass UI overhaul (`styles.css` utilities and layout implementations).
- Separate Mobile (Floating Nav + Sheets) and Desktop (Sidebar) UX in `AppShell.tsx`.
- Follow-up Card layout fixed to permanently show Assessment Date, Last Follow-up, and Next Follow-up without clipping.
- Development-only QA Authentication Bypass with real Supabase sessions.
- Framer Motion integrated for premium micro-interactions.

## Pending Features & Known Limitations

- Offline mode and PWA/Capacitor packaging for native mobile experiences are planned but not yet implemented.
- End-to-end (E2E) automated testing suite (e.g., Maestro or Playwright) could be expanded for the new UI flows.
- Map visualization requires a configured map tile provider (currently using leaflet with default tiles).
