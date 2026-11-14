# Nasaspaceapps

## Supabase

Install dependencies with `npm install`, then configure `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` in the environment. `.env.example` lists the
variables; copy it to `.env` for local development. Do not commit `.env`.

The Supabase client is exported from `Backend/backend.ts`. Database-specific
types and queries can be added once the project's schema is defined.
