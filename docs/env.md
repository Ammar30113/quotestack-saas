# Environment Variables

This project uses different environment variables for the frontend (Vercel) and backend (Railway).

## Frontend (Vercel)

- `NEXT_PUBLIC_API_URL` (or `NEXT_PUBLIC_API_BASE_URL`): Base URL of the backend API, e.g. `https://your-backend.up.railway.app`
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key
- `NEXT_PUBLIC_SENTRY_DSN`: Frontend Sentry DSN (optional)

## Backend (Railway)

- `FRONTEND_URL`: Allowed browser origin(s) for CORS (comma-separated), must include `https://` (e.g. `https://quotestack-saas.vercel.app,https://staging-quotestack.vercel.app`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon public key
- `SUPABASE_JWT_SECRET`: Required for legacy HS256 Supabase JWT verification (do not use the service role key)
- `SENTRY_DSN`: Backend Sentry DSN (optional)

## Notes

- When `NEXT_PUBLIC_API_URL` is not set, the frontend defaults to `http://127.0.0.1:8000` for local development.
- HS256 tokens require `SUPABASE_JWT_SECRET`; RS256 tokens are verified via Supabase JWKS at `SUPABASE_URL/auth/v1/keys`.
