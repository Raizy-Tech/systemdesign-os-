# SystemDesign.OS — Production Architecture Simulator

An interactive React simulator for exploring a production-style web request path: browser, CDN, WAF, rate limiter, JWT/RBAC, Kubernetes pods, Redis, PostgreSQL replicas, async queue, observability, and CI/CD.

> **Important:** this is an educational, client-side simulation. It does not provision real Cloudflare, Redis, PostgreSQL, Kafka, Kubernetes, JWT verification, or CI/CD infrastructure. Latencies, logs, metrics, failover, and deployments are simulated in browser state.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validate and build

```bash
npm run test:source
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the framework preset as **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. No environment variables are required for this front-end-only simulator.

Vercel can also deploy this repository automatically on each push after the Git integration is connected.

## Main scenarios

- Product cache hit and analytics cache miss / warm-up
- Checkout transaction and cache invalidation
- SQL injection and XSS blocked by WAF toggles
- Burst traffic / token-bucket throttling
- Expired JWT and RBAC-denied admin action
- Database outage and replica failover behavior

## Architecture notes

See `docs/ARCHITECTURE-LEARNING-GUIDE.md` for the request path, each subsystem, simulator limitations, and a beginner-friendly learning sequence.