# AGENTS.md

## Project

Web panel + API for checklist operations built with Next.js (App Router) + TypeScript + MongoDB (Mongoose).
It includes auth/session handling, role-based access, template/version management, checklist APIs, trip/assignment modules, and admin tools.

## Related Projects

- Mobile app (React Native + Expo): `D:\CopiaD\backUp\Proyectos App\checkList`
- This web project (Next.js): `D:\CopiaD\backUp\Proyectos Web\check-list`

## How To Work

- Before touching code, first explain what is proposed, how it will be done, and where.
- Do not modify any code until the user explicitly approves the proposed plan.
- Make minimal, clear, and easy-to-verify changes.
- Do not refactor unrelated parts.
- Move in stages, prioritizing small changes.

## Rules

- Use TypeScript for app/lib/components/models.
- Do not add libraries unless truly necessary.
- Do not duplicate logic.
- Do not use hacks.
- Do not leave dead code.
- Do not break route handlers, auth/session contracts, or existing flows.
- Never commit or push directly to `main`.

## Structure

- `app`: pages and App Router entry points
- `app/api`: backend route handlers (auth, templates, checklists, trips, admin)
- `components`: reusable UI and auth wrappers
- `lib`: database/auth/roles/server helpers
- `models`: Mongoose schemas/models
- `scripts`: maintenance scripts (example: inspectors seed)
- `public`: static assets

## Docs Index

- No dedicated `docs/` directory currently.
- Baseline project readme: `README.md`

## Main Flow

1. Root redirect in `app/page.tsx` -> `/login`.
2. Login UI in `app/login/page.tsx` + `components/LoginForm.tsx`.
3. Auth request in `POST /api/auth/login` (session cookie set).
4. Session validation via `GET /api/auth/me` and guarded navigation.
5. Dashboard/module access in `app/dashboard/page.tsx` and role-gated screens.
6. Operational APIs under `app/api/*` for templates, checklists, trips, assignments, admin.

## Backend Integration (Critical Contracts)

- Mobile app depends on this API behavior; keep response contracts backward-compatible.
- Core auth endpoints:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Core checklist/template endpoints used across web/mobile:
  - `GET /api/mobile/my-assignments`
  - `GET /api/my-assignments`
  - `GET /api/templates`
  - `GET /api/templates/:templateId`
  - `POST /api/checklists`
  - `GET /api/checklists`
- Additional domain endpoints exist for trips, template versions, review status, and admin user/inspector management under `app/api`.
- Keep compatibility for:
  - session cookie name/options (`session`, httpOnly, sameSite)
  - role payload shape (`role`, `roles`)
  - checklist/template/trip payloads consumed by mobile.

## Environment Variables

- `DATABASE_URL` (required): MongoDB connection string (`lib/db.ts`).
- `NODE_ENV` affects secure cookie behavior in `lib/server/session-cookie.ts`.

## Next.js / Backend Notes

- Preserve App Router conventions (`app/` and `app/api/**/route.ts`).
- Preserve session flow (DB-backed session + cookie).
- Be careful with role checks and permission gates.
- Handle loading/error/empty states in client pages.
- Keep API handlers defensive with clear status codes and JSON responses.

## Validation

- Review types and imports.
- Verify login/logout/me session cycle.
- Verify role-based access and protected routes.
- Verify critical API contracts for mobile compatibility.
- Before any commit, run `npm run build` and ensure it finishes successfully.
- Never commit if `npm run build` fails.
- Report touched files and what to test.

## Useful Commands

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `node scripts/seed-inspectors.js` (manual seed script)
