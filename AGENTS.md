<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Antigravity Agent Policy & Execution Workflow

## 1. Master Development Workflow

When executing complex features, bug fixes, or enhancements, follow this strict pipeline:

```
DISCOVER
  ↓
PLAN
  ↓
ARCHITECTURE
  ↓
DESIGN
  ↓
IMPLEMENT FRONTEND
  ↓
IMPLEMENT BACKEND
  ↓
IMPLEMENT SUPABASE DATABASE
  ↓
CONFIGURE AUTH + RLS
  ↓
IMPLEMENT AI AGENT
  ↓
IMPLEMENT VOICE/REALTIME
  ↓
TEST
  ↓
SECURITY AUDIT
  ↓
UI/UX AUDIT
  ↓
PERFORMANCE AUDIT
  ↓
BUILD
  ↓
DEPLOY
  ↓
FINAL VERIFICATION
```

---

## 2. UI/UX Development Policy

Whenever creating or modifying UI components or pages:

1. **Design System Consistency**: Inspect the existing design system tokens and reuse established Tailwind tokens (`oklch` palette, Radix UI primitives, glassmorphism, soft card surfaces).
2. **Apple / iPhone-First Aesthetics**: For iPhone or mobile-oriented layouts, apply liquid glass depth, soft blur backdrop, responsive touch targets (minimum 44px), safe area paddings, and smooth transition animations.
3. **Design Review**: Use `ios-design-agent-skill` and `ui-ux-pro-max` to review aesthetics and hierarchy after UI implementation. Avoid generic AI dashboard designs.
4. **Accessibility (WCAG)**: Ensure proper ARIA roles, dynamic contrast, and keyboard navigation.

---

## 3. Database & Supabase Policy

Whenever modifying Supabase or PostgreSQL:

1. **Schema & Migration Audit**: Inspect existing database schema and migrations before introducing changes. Write safe SQL migrations.
2. **Strict RLS Enforcement**: Every table MUST have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
3. **Never Disable RLS**: NEVER solve a permission issue or test failure by disabling RLS or using service-role overrides inappropriately.
4. **Credential Isolation**: NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code or frontend `.env` variables. Use server functions or RLS policies.
5. **Database Skill Usage**: Always consult `supabase` and `supabase-postgres-best-practices` skills when authoring database changes.

---

## 4. Skill Discovery & Execution

The agent must proactively discover and activate relevant skills located in `.agents/skills/`:

- `supabase` & `supabase-postgres-best-practices` for database tasks.
- `ui-ux-pro-max`, `ui-styling`, `design-system` for UI design.
- `ios-design-agent-skill` & `ios-native` for iPhone / Apple styling & native UI review.
- `agent-browser`, `playwright-cli`, `mobile-testing` for testing & E2E verification.
- `voice-ai` for realtime voice audio UX.
- `security-audit` for OWASP & RLS auditing.
- `performance-optimization` for frontend & query tuning.
- `deployment-ci-cd` for build & release verification.
