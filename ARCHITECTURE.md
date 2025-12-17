# QuoteStack Architecture

This doc explains how the app is put together today and the agreed data-access pattern.

## Stack at a Glance
- Frontend: Next.js (App Router) + Tailwind, deployed on Vercel.
- Backend: FastAPI, using Supabase PostgREST for persistence.
- Auth & tenancy: Supabase Auth (JWT) + Postgres Row Level Security (RLS) with per-user ownership.

## Data-Access Pattern (Backend-for-Frontend)
- **Single path for app data:** The frontend calls the FastAPI backend for all CRUD on deals and quotes. The frontend does **not** talk directly to Supabase for data (only for auth tokens).
- **Auth flow:** Frontend signs in with Supabase JS, gets an access token, and includes it as `Authorization: Bearer <jwt>` on every backend request.
- **Backend validation:** FastAPI validates the Supabase JWT with `SUPABASE_JWT_SECRET`, extracts `user_id`, and uses it to scope calls.
- **DB access:** Backend calls Supabase REST with the user’s JWT so Supabase RLS enforces per-user isolation.
- **Result:** Consistent business logic in one place (FastAPI) and defense-in-depth via RLS.

## Request Lifecycle
1) User signs in on frontend via Supabase JS → receives access token.  
2) Frontend calls backend REST (`/deals`, `/quotes`, etc.) with `Authorization: Bearer`.  
3) Backend validates JWT, builds a Supabase REST client with the same token, and performs CRUD.  
4) Supabase RLS filters rows to `user_id = auth.uid()`.  
5) Backend maps DB rows to API shapes and returns JSON to the frontend.

## Components
- **Frontend** (`frontend/`):
  - Routes: `/login` (Supabase email/password), `/deals` (list/create), `/deals/[id]` (quote entry + comparison), root redirects to `/deals`.
  - API client: `lib/api.ts` calls backend `NEXT_PUBLIC_API_URL`.
  - Supabase client: `lib/supabaseClient.ts` for auth/session handling only.
- **Backend** (`backend/`):
  - Entrypoint: `backend/main.py` with routers for `/deals` and `/quotes`.
  - Auth: `backend/core/auth.py` extracts/validates JWT, returns `UserContext`.
  - Config: `backend/core/config.py` loads env (app name, debug, Supabase URL/keys/JWT secret).
  - Data access: `backend/services/supabase_client.py` wraps Supabase REST using the user’s token.
  - Schemas: `backend/models/schemas.py` (Pydantic models for validation).
  - RLS helper SQL: `backend/sql/rls_policies.sql` adds `user_id`, enables RLS, and defines owner-only policies on `deals` and `quotes`.
- **Database** (Supabase Postgres):
  - Tables: `deals`, `quotes` with `user_id` owner column and FK quotes.deal_id → deals.id.
  - RLS: enabled on both tables to ensure users only see their own rows.

## Data Models (API Shapes)
- **Deal:** `id`, `company_name`, `currency`, `description`, `created_at`.
- **Quote:** `id`, `deal_id`, `amount` (stored as `price` in DB), `currency`, `supplier`, `lead_time_days` (`lead_time` alias in requests), `moq`, `created_at`.

## Environment Variables
- Backend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `APP_NAME`, `DEBUG`, `PORT` (optional).
- Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (defaults to http://127.0.0.1:8000).

## Running Locally (developer workflow)
- Backend: `python -m uvicorn backend.main:app --reload --port 8000` (ensure env vars are set).
- Frontend: `npm install` (once), then `npm run dev` in `frontend/` (ensure NEXT_PUBLIC_* envs and API URL point at the backend).

## Future Hooks
- Observability: add structured logging and error tracking with tenant/user context.
- Background work: use FastAPI BackgroundTasks for small jobs; plan for a queue if heavy workloads appear.
- Pagination & rate limits: apply on list endpoints to keep queries efficient as data grows.
