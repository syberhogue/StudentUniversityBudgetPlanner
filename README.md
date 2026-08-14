# Ontario Tech Student Financial Planner

Production-shaped Vite React app for Ontario Tech student budgeting, RESP runway modeling, household contribution splits, deadlines, sharing, and offline sandbox planning.

## Local Development

```bash
npm install
npm run dev
```

The app runs without Supabase credentials in Sandbox Mode using browser localStorage. To enable Supabase Auth and persistence, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

Deploy the Vite app to Vercel with the environment variables from `.env.example`. The included `vercel.json` sends all app routes back to `index.html`, so direct loads of `/app`, `/auth`, and `/share/:token` work in production.

### Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` locally and in Vercel. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

### Admin Roles

The Admin page is visible only to signed-in users whose Supabase Auth app metadata contains `"role": "admin"`. Set this in the Supabase Dashboard under Authentication -> Users -> select the user -> Raw app meta data:

```json
{
  "role": "admin"
}
```

You can also set it from the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

After changing app metadata, have the user sign out and sign back in so their JWT includes the new role.

### Vercel

```bash
npm run build
vercel link
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

GitHub Actions validates lint, typecheck, tests, and build on pull requests and main branch pushes. Production deployment from CI requires the `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets.
