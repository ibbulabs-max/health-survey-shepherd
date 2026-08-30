---
name: security-audit
description: >-
  Security review guidelines, RLS audit rules, OWASP prevention, API authorization checks,
  and secret management for Supabase and modern web applications. Use when auditing code,
  updating database policies, verifying authentication, or preparing for production deployment.
---

# Application Security & Audit Skill

## Mandatory Security Rules

1. **Never Disable RLS**: NEVER solve a database permission issue by disabling Row Level Security (RLS) or granting `SECURITY DEFINER` recklessly.
2. **Never Expose Service Role Credentials**: The Supabase service-role key (`SUPABASE_SERVICE_ROLE_KEY`) MUST NEVER be included in frontend bundles, `.env.public`, or client-side code.
3. **Least-Privilege Authorization**: Check `auth.uid()` and explicit user roles/permissions on every read, write, update, and delete policy.

## Security Audit Checklist

### 1. Database & Supabase RLS

- [ ] Every table in public schema has `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`.
- [ ] Policies exist for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` explicitly.
- [ ] Functions marked as `SECURITY DEFINER` specify `SET search_path = ''` to prevent search path hijacking.
- [ ] Storage buckets have strict RLS policies restricting file upload, read, and delete permissions.

### 2. Frontend & API Security

- [ ] Validate all user inputs using Zod or equivalent schemas before passing to queries.
- [ ] Sanitise user-generated HTML to prevent XSS (Cross-Site Scripting).
- [ ] Protect against CSRF by enforcing CORS policies and proper cookie attributes (`SameSite=Lax/Strict`, `HttpOnly`, `Secure`).
- [ ] Ensure authentication middleware checks JWT token validity on protected server routes.

### 3. Environment Variables & Secrets

- [ ] Verify `.env` files containing secrets are in `.gitignore`.
- [ ] Ensure only public keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are exposed to client code.
