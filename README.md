# Tutor Course Platform

The first working foundation for the platform described in `requirements.docx`. The monorepo keeps the public website, admin panel, API, shared contracts, and Flutter app separate while allowing them to evolve together.

## Apps

- `apps/web` - public course discovery and conversion website on port 3000
- `apps/admin` - operations dashboard on port 3001
- `apps/api` - Fastify API and Prisma schema on port 4000
- `apps/mobile` - Flutter student app starter
- `packages/contracts` - shared API and domain types

## Local setup

1. Copy `.env.example` to `.env` and replace development secrets.
2. Run `docker compose up -d` for PostgreSQL, MinIO, and Mailpit.
3. Run `pnpm install`.
4. Run `pnpm db:generate` and `pnpm db:migrate`.
5. Run `pnpm dev`.

The public and admin apps currently use polished demo data so the experience is usable before the first database migration. The API exposes the same public catalog shape and is ready to replace those fallbacks as persistence is wired in.

## Current milestone

- Responsive public home, catalog, and course-detail pages
- Responsive admin overview, course list, and brand settings screens
- Public settings and course endpoints with validated query parameters
- PostgreSQL schema for users, roles, courses, lessons, enrollments, progress, orders, payments, coupons, CMS, email, notifications, settings, and audit logs
- Flutter student home and learning-progress shell
- Local infrastructure for database, object storage, and email testing
