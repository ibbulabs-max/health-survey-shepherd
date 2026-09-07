# NCD Management Platform — Commercial & Production Deployment Runbook

This document is the definitive guide for deploying, configuring, and operating the NCD Management Platform in production across multiple NGO tenants and commercial health deployments.

---

## 1. System Architecture & Multi-Tenancy

The platform is designed with a modern offline-first React 19 + TanStack Router architecture backed by PostgreSQL (Supabase) and Dexie.js for client-side persistence.

### Hierarchy & Tenant Isolation

```
[Master Admin] (Multi-Org Governance & System Oversight)
       │
       ▼
[Organization / NGO Tenant] (Strict Tenant Boundary via organization_id)
       ├── [Admins] (Org Configuration, Bulk Import Approvals, User Management)
       ├── [Supervisors] (Team Workflows, Review Queues, Territory Assignment)
       └── [Community Health Workers / CHWs] (Household Mapping, Screenings, Follow-ups)
```

- **Row Level Security (RLS)**: Every single table enforces PostgreSQL Row Level Security. Data isolation is maintained via `organization_id` matching `user_roles.organization_id`.
- **Master Admin (`master_admin`)**: Bypasses organization filtering to oversee all NGO tenants, review cross-tenant system health, and manage tenant provisioning.

---

## 2. Environment Variables & Configuration

### Frontend Client (`.env.production`)

| Variable                 | Required                | Description                                               |
| :----------------------- | :---------------------- | :-------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | **Yes**                 | HTTPS URL of the Supabase project instance                |
| `VITE_SUPABASE_ANON_KEY` | **Yes**                 | Public anonymous client key with RLS enforcement          |
| `VITE_APP_TITLE`         | Optional                | Custom white-label title for the NGO deployment           |
| `VITE_QA_ROLE`           | **STRICTLY PROHIBITED** | Must NOT be set in production (bypasses auth for QA only) |

> [!CAUTION]
> **Credential Isolation**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend client environments or `.env` files deployed to Vercel/Netlify. Service role keys must only be used in secure edge functions or backend scripts.

---

## 3. Provisioning a New NGO Tenant (Step-by-Step)

To onboard a new NGO or healthcare partner:

### Step 1: Create Organization Record

```sql
INSERT INTO organizations (id, name, slug, status, created_at)
VALUES (
    gen_random_uuid(),
    'Hope Healthcare Foundation',
    'hope-healthcare',
    'ACTIVE',
    now()
) RETURNING id;
```

### Step 2: Provision Admin Account

1. Create user in `auth.users` via Supabase Auth or admin script.
2. Assign the `admin` role with the organization ID:

```sql
INSERT INTO user_roles (user_id, role, organization_id)
VALUES ('<USER_AUTH_ID>', 'admin', '<ORGANIZATION_ID>');
```

### Step 3: Configure Default Clinical Thresholds

Admins can customize risk follow-up intervals in **Settings**:

- **High Risk**: Default 15 days
- **Moderate Risk**: Default 30 days
- **Normal Risk**: Default 180 days
- **Weekend / Holiday Protection**: Automatically pushes follow-ups falling on non-working days to the next working day.

### Step 4: Bulk Ingestion via Smart Import

1. Navigate to **Smart Import** (`/import`).
2. Upload NGO spreadsheet (.xlsx / .csv).
3. The system maps canonical fields (`name`, `phone`, `age`, `gender`, `bp`, `sugar`) and preserves all custom columns inside `data` JSONB.
4. Auto-Approval toggle allows instant ingestion or supervisor queue review.

---

## 4. Operational Features Reference

### 1. Geospatial Territory Mapping & Geofencing

- **Polygon Drawing**: Supervisors can draw exact territory boundaries on Leaflet maps.
- **CHW Assignment**: Assign specific polygons to field operatives.
- **GPS Sharing**: Field workers can toggle live location sharing with ray-casting geofence breach alerts.

### 2. Dynamic Discovery Analytics

- Automatically scans all non-standard spreadsheet fields stored in `data` JSONB.
- Surfaces visual horizontal candle rails for age brackets, education, occupational data, and clinical vitals without requiring schema migrations.

### 3. Team Chat & Video Syncs

- Real-time communication channel `#general` with optimistic local caching.
- Integrated meeting schedule manager with one-click Google Meet / Zoom launching.

---

## 5. Security & Compliance Checklist

- [x] **PostgreSQL RLS Active**: All public tables have RLS enabled and validated.
- [x] **Canonical Eligibility Check**: Follow-up loops strictly enforce `age >= 30` and `eligible === "Yes"`.
- [x] **Continuous Follow-up Invariant**: Completing an active follow-up produces exactly one new pending follow-up.
- [x] **Audit Trail**: Administrative actions, territory modifications, and bulk imports are logged to `audit_logs`.
- [x] **Offline-First Synchronization**: Dexie.js stores in-flight changes with retry backoff and payload schema sanitization.

---

## 6. Build & Deployment Commands

```bash
# Install dependencies
npm install

# Run TypeScript typecheck
npx tsc --noEmit

# Run automated business logic & projection tests
npx tsx tests/business-logic.ts

# Production Build
npm run build
```
