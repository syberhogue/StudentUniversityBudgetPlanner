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

Deploy the Vite app to Vercel with the environment variables from `.env.example`. GitHub Actions validates lint, typecheck, tests, and build on pull requests and main branch pushes.
