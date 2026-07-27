# Pucuk Pilot

Mobile-first prototype for shared fresh-tea-leaf receipts: intake, manual quality
assessment, integer-IDR pricing, farmer confirmation, public verification,
payment status, and dispute handling.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run typecheck
npm run build
npm start
```

## Deploy to Vercel

This is a standard Next.js application and needs no custom Vercel configuration.

1. Import this GitHub repository in Vercel.
2. Keep the detected framework as **Next.js**.
3. Keep the root directory as the repository root.
4. Deploy.

No production secrets are required for the current seeded prototype. Future
Privy, Supabase, Base RPC, registry, and relayer credentials should be added
through Vercel Environment Variables and never committed.
