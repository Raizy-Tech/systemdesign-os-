# SystemDesign.OS — Code Audit and Test Report

## Scope

Reviewed the complete 1,742-line uploaded React component and converted it into a Vite project with a README, deployment configuration, CI workflow, and beginner learning guide.

## Findings fixed

| Severity | Finding in uploaded source | Change made |
|---|---|---|
| High | The XSS protection toggle was displayed but did not participate in request simulation. | Added a dedicated XSS scenario and wired it to `wafXssEnabled`. |
| High | The analytics cache-miss scenario never created a Redis entry, so it could not become a cache hit on the next request. | Added a cache key, miss path, cache population, and subsequent hit behavior. |
| High | With the primary database offline and zero replicas, GET requests could fall through as if the database were healthy. | All database requests now return a simulated HTTP 503 when both primary and failover replicas are unavailable. |
| Medium | Checkout described cache invalidation but did not remove stale cache entries. | Successful checkout now invalidates product and analytics entries. |
| Medium | Simulation and CI/CD timers were not cleaned up when the component unmounted. | Added timer references and unmount cleanup. |
| Medium | Scenario cards were clickable `div` elements without keyboard interaction. | Added button semantics, keyboard activation, accessible labels, and focus styling. |
| Low | Raw `<script>` text and `->` text in JSX could be parsed as JSX syntax. | Escaped the displayed text so the component parses correctly. |

## Remaining limitations (intentional simulation boundaries)

- JWT header/payload are illustrative; no signature is cryptographically verified and no real identity provider is contacted.
- WAF checks are preset scenario switches, not a production-grade request inspection engine.
- Redis TTL is displayed but entries do not expire automatically.
- PostgreSQL failover, replication lag, transactions, and Kafka delivery are simulated in React state; there is no real database, broker, or durable queue.
- HPA pod counts and CPU are simplified estimates, not Kubernetes metrics or scheduling behavior.
- CI/CD stages are a timed visual simulation; they do not execute tests, build a container, or deploy to Kubernetes.
- Metrics and logs are generated in the browser and are not collected from real services.
- This is not a security test harness and must not be used to evaluate production security or capacity.

## Validation results

| Check | Result | Notes |
|---|---|---|
| JSX/JavaScript parse check | PASS | TypeScript compiler parser (`tsc`, JSX mode) returned no syntax diagnostics for `src/App.jsx`. |
| Source smoke checks | PASS | 9 checks covering WAF, rate limiting, DB outage, cache behavior, checkout invalidation, cleanup, CI/CD, and chart presence. |
| npm dependency installation | BLOCKED | The environment could not reach `registry.npmjs.org`; offline install also confirmed packages were not cached. |
| Vite production build | NOT RUN | Vite and project dependencies could not be installed in this environment. Run `npm install && npm run build` locally or let GitHub Actions/Vercel run it. |
| Browser interaction / visual regression | NOT RUN | No browser runtime or installed dependencies were available in this environment. |
| Live Vercel deployment | NOT CREATED | No new GitHub repository creation action was available, and the existing Vercel Git project is linked to the separate `new-project` repository. That project was not reused to avoid mixing this simulator into the existing site. |

## Deployment readiness

The project includes `vercel.json`, Vite build settings, and a GitHub Actions workflow. It is ready to import into a **new, dedicated GitHub repository** after the project files are pushed. No environment variables are required.

Recommended first production gate:

```bash
npm install
npm run test:source
npm run build
```

Only deploy after all three commands pass in CI.