# Architecture and Learning Guide

## 1. Request lifecycle

A typical request in this simulator moves through:

1. **Browser / client** — sends an HTTP request.
2. **CDN / edge** — terminates TLS and may serve cached static assets.
3. **WAF** — inspects requests for suspicious SQL injection or XSS patterns.
4. **API gateway / rate limiter** — checks the token bucket before forwarding.
5. **Authentication and authorization** — checks token expiry and role permissions.
6. **Load balancer / compute** — chooses a backend pod; CPU load and pod count are simulated.
7. **Redis cache** — returns a cached response or records a cache miss.
8. **PostgreSQL** — reads from replicas and writes to the primary; failover is represented as simulated state.
9. **Kafka / workers** — checkout emits an asynchronous order event.
10. **Observability** — request logs, latency charts, alerts, and CI/CD stage states are displayed.

## 2. Core concepts

| Concept | Beginner explanation | Why it exists |
|---|---|---|
| CDN | A nearby copy of static files | Reduces latency and origin traffic |
| WAF | A filter in front of the application | Blocks suspicious HTTP requests |
| Token bucket | A container that refills tokens over time | Allows bursts while limiting sustained traffic |
| JWT | A signed set of identity claims | Carries identity and expiry information |
| RBAC | Permissions based on a user's role | Restricts sensitive operations |
| Load balancer | Distributes requests across servers | Prevents one server from taking all traffic |
| Kubernetes HPA | Adds/removes pod replicas based on load | Adjusts compute capacity |
| Redis | Very fast in-memory key/value store | Avoids repeated database reads |
| PostgreSQL replica | A copy of the primary database | Scales reads and supports recovery |
| Message queue | Stores work for background consumers | Keeps slow tasks out of the request path |
| Observability | Logs, metrics, and traces | Helps explain system behavior and failures |

## 3. Important distinctions

- Authentication asks **who are you?** Authorization asks **what are you allowed to do?**
- A cache hit returns an existing value; a cache miss requires the source of truth to be queried.
- A read replica is not automatically a writable primary. Real promotion requires orchestration and consistency checks; the simulator models promotion as a simplified event.
- A browser-side chart is not production telemetry. Real systems collect metrics and traces from instrumented services.
- A CI/CD animation is not a real pipeline. Real CI/CD requires a workflow runner, tests, image registry, deployment credentials, and rollout health checks.

## 4. How to learn this project

1. Start with `REQUEST_SCENARIOS` and read the six request presets.
2. Follow `buildSimulationTrace` from the client hop to the terminal response.
3. Change the WAF toggles and run SQLi / XSS scenarios.
4. Drain the token bucket, then observe HTTP 429 and token refill.
5. Change the role or expire the JWT, then run checkout and admin scenarios.
6. Flush Redis and run the analytics request twice to observe miss then hit.
7. Crash the primary database with zero replicas and observe the service-unavailable path.
8. Increase traffic and compare automatic versus manual pod counts.
9. Trigger the CI/CD animation and inspect the structured logs.

## 5. Current simulation boundaries

All system components are represented by React state and timers. No external infrastructure is contacted, no real JWT cryptographic verification occurs, no SQL is executed, and no real attack traffic is sent. Treat the output as an interactive teaching model, not a security or capacity test.