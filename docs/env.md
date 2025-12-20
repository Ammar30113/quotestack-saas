# Environment Variables

This project uses different environment variables for the frontend (Vercel) and backend (Railway).

## Frontend (Vercel)

- `NEXT_PUBLIC_API_URL` (or `NEXT_PUBLIC_API_BASE_URL`): Base URL of the backend API, e.g. `https://your-backend.up.railway.app`
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key
- `NEXT_PUBLIC_SENTRY_DSN`: Frontend Sentry DSN (optional)

## Backend (Railway)

- `FRONTEND_URL`: Allowed browser origin for CORS, must include `https://` (e.g. `https://quotestack-saas.vercel.app`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon public key
- `SUPABASE_JWT_SECRET`: Required for legacy HS256 Supabase JWT verification (do not use the service role key)
- `SENTRY_DSN`: Backend Sentry DSN (optional)

## Notes

- When `NEXT_PUBLIC_API_URL` is not set, the frontend defaults to `http://localhost:8080` for local development.
- If your Supabase project uses RS256/JWKS tokens, this backend needs a verification update; HS256 uses `SUPABASE_JWT_SECRET`.
