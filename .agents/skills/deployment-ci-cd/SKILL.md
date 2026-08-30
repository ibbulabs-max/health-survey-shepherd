---
name: deployment-ci-cd
description: >-
  Deployment best practices, Vercel build configuration, GitHub Actions CI/CD workflows,
  environment variable verification, and build verification. Use when configuring build pipelines,
  preparing releases, or setting up deployment workflows.
---

# Production Deployment & CI/CD Skill

## Core Principles

1. **Zero-Downtime Builds**: Verify production builds locally using `npm run build` or `vite build` before pushing to main.
2. **Environment Isolation**: Maintain separate environment variables for development, staging, and production.
3. **Automated Verification**: Run linting, type checks (`tsc --noEmit`), and E2E tests in CI/CD before deployment.

## Deployment Checklist

- [ ] Verify `npm run build` compiles clean without missing imports or type errors.
- [ ] Check environment variable bindings in hosting provider (e.g. Vercel dashboard).
- [ ] Confirm database schema migrations are applied to production Supabase project before code deployment.
- [ ] Verify HTTPS redirect and security headers.
