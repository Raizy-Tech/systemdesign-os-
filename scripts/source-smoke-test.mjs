import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const checks = [
  ['SQL injection WAF path', /scenario\.id === 'sqli'/],
  ['XSS WAF path', /scenario\.id === 'xss'/],
  ['rate-limit exhaustion', /scenario\.id === 'ddos' \|\| tokensAvailable <= 0/],
  ['database unavailable guard', /!primaryDbAlive && replicaCount === 0/],
  ['analytics cache key', /analytics:revenue-report:v1/],
  ['checkout cache invalidation', /scenario\.id === 'checkout'[\s\S]*?setCacheEntries/],
  ['timer cleanup on unmount', /simulationTimersRef\.current\.forEach\(clearTimeout\)/],
  ['CI pipeline state', /triggerCiPipeline/],
  ['observability charts', /<AreaChart/],
];
for (const [name, pattern] of checks) {
  assert.match(source, pattern, `Missing expected behavior: ${name}`);
  console.log(`PASS ${name}`);
}