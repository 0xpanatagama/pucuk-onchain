# Pucuk Pilot

Pucuk is a shared transaction record for tea-leaf deliveries. The web product
and smart contract model the same commercial lifecycle across operator, farmer,
factory, and auditor roles.

## Smart contract

`contracts/PucukReceiptRegistry.sol` is an append-only receipt registry. It:

- records hashes of the commercial payload and private evidence;
- requires the assigned farmer to accept or reject the operator's draft;
- lets the assigned factory approve the payable liability;
- records full or partial IDR payment evidence without transferring funds;
- allows permitted participants to open disputes;
- lets an auditor request evidence, reinstate the original, or issue a linked
  replacement without deleting the original receipt; and
- rejects direct native-token transfers.

Do not put names, phone numbers, bank references, photographs, exact farm
coordinates, or dispute narratives on-chain. Store those privately and submit
only canonical hashes.

### Local verification

```bash
pnpm contracts:compile
pnpm contracts:test
```

### Base Sepolia configuration

Hardhat reads these environment variables only when the `baseSepolia` network
is used:

```text
BASE_SEPOLIA_RPC_URL=
BASE_SEPOLIA_PRIVATE_KEY=
```

Never commit a private key or `.env` file. The contract does not execute
payments and should not receive ETH.

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
