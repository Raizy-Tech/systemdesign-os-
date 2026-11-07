import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe, Shield, Cpu, Database, Server, Lock, Activity, Terminal,
  Zap, AlertTriangle, CheckCircle2, XCircle, Play, RefreshCw,
  Layers, Sliders, HardDrive, Share2, Radio, GitBranch, Search,
  Key, Users, Eye, ArrowRight, Flame, CloudLightning, BarChart3,
  Clock, Filter, Trash2, Check, ChevronRight, AlertOctagon, HelpCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

// --- CONSTANTS & PRESET SCENARIOS ---
const ARCHITECTURE_NODES = [
  { id: 'client', name: 'Browser / Client', sub: 'React CSR/SSR + Core Web Vitals', icon: Globe, category: 'Frontend', baseLatency: 5 },
  { id: 'cdn', name: 'CDN & Edge Cache', sub: 'Cloudflare Anycast PoP', icon: CloudLightning, category: 'Edge', baseLatency: 8 },
  { id: 'waf', name: 'WAF & DDoS Shield', sub: 'OWASP Rules & Bot Filtering', icon: Shield, category: 'Security', baseLatency: 4 },
  { id: 'ratelimit', name: 'API Gateway & Rate Limit', sub: 'Redis Token Bucket', icon: Sliders, category: 'Gateway', baseLatency: 3 },
  { id: 'auth', name: 'Auth & Permissions', sub: 'OIDC / JWT + RBAC Engine', icon: Lock, category: 'Identity', baseLatency: 6 },
  { id: 'lb', name: 'Load Balancer & K8s Pods', sub: 'Envoy Ingress + HPA Compute', icon: Cpu, category: 'Compute', baseLatency: 15 },
  { id: 'cache', name: 'Redis Cache Tier', sub: 'In-Memory Cache-Aside Cluster', icon: Zap, category: 'Data', baseLatency: 2 },
  { id: 'db', name: 'PostgreSQL + Object Store', sub: 'Primary + Read Replicas + S3', icon: Database, category: 'Storage', baseLatency: 42 },
  { id: 'queue', name: 'Kafka + Async Workers', sub: 'Event Bus + Background Jobs', icon: Share2, category: 'Async', baseLatency: 12 },
];

const REQUEST_SCENARIOS = [
  {
    id: 'cache_hit',
    name: 'GET /api/v1/products',
    badge: 'Cache Hit (Fast)',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    method: 'GET',
    endpoint: '/api/v1/products?category=featured',
    description: 'Reads product catalog. Served rapidly via Redis In-Memory Cache without hitting PostgreSQL.',
    payload: null,
  },
  {
    id: 'cache_miss',
    name: 'GET /api/v1/analytics',
    badge: 'Cache Miss -> DB Replica',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    method: 'GET',
    endpoint: '/api/v1/analytics/revenue-report',
    description: 'Complex aggregation query. Misses Redis cache, queries PostgreSQL Read Replica, and populates cache.',
    payload: null,
  },
  {
    id: 'checkout',
    name: 'POST /api/v1/checkout',
    badge: 'Full Pipeline + Async Queue',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    method: 'POST',
    endpoint: '/api/v1/checkout',
    description: 'Transactional write to Primary DB, invalidates cache, and dispatches receipt email job to Kafka queue.',
    payload: '{"cartId": "crt_9821", "amount": 249.00, "currency": "USD"}',
  },
  {
    id: 'sqli',
    name: 'SQL Injection Attack',
    badge: 'Blocked by WAF (403)',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    method: 'GET',
    endpoint: "/api/v1/users?id=1' OR '1'='1' --",
    description: 'Malicious SQL injection payload detected at the Edge WAF layer before touching application servers.',
    payload: null,
  },
  {
    id: 'xss',
    name: 'Cross-Site Scripting Attack',
    badge: 'Blocked by WAF (403)',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    method: 'POST',
    endpoint: '/api/v1/comments',
    description: 'Malicious script payload is inspected by the edge WAF before reaching the application.',
    payload: '{"comment": "<script>alert(1)</script>"}',
  },
  {
    id: 'ddos',
    name: 'Burst Traffic Spike',
    badge: 'Rate Limited (429)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    method: 'POST',
    endpoint: '/api/v1/login-attempt',
    description: 'Simulates an exhausted Token Bucket at the API Gateway, returning HTTP 429 Too Many Requests.',
    payload: '{"username": "admin", "password": "***"}',
  },
  {
    id: 'unauth',
    name: 'DELETE /api/v1/admin/db',
    badge: 'RBAC Denied (403)',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    method: 'DELETE',
    endpoint: '/api/v1/admin/purge-users',
    description: 'Requires Admin role scope. Standard Users or Guests are rejected by the Auth/RBAC middleware.',
    payload: null,
  },
];

const INITIAL_CACHE_KEYS = [
  { key: 'products:featured:v1', ttl: 3540, size: '14.2 KB', hits: 1284, value: '[{"id":"p1","name":"Mechanical Keyboard","price":149}]' },
  { key: 'session:usr_99201', ttl: 840, size: '1.1 KB', hits: 42, value: '{"userId":"usr_99201","role":"user","mfa":true}' },
  { key: 'config:feature_flags', ttl: 86400, size: '0.6 KB', hits: 9410, value: '{"newCheckout":true,"canaryPct":15}' },
];

export default function App() {
  // Navigation & Active View
  const [activeTab, setActiveTab] = useState('simulator');
  const [selectedNodeId, setSelectedNodeId] = useState('client');

  // --- GLOBAL SYSTEM CONFIGURATION STATE ---
  // Security & Rate Limit State
  const [wafSqlEnabled, setWafSqlEnabled] = useState(true);
  const [wafXssEnabled, setWafXssEnabled] = useState(true);
  const [bucketCapacity, setBucketCapacity] = useState(10);
  const [tokensAvailable, setTokensAvailable] = useState(10);
  const [refillRate, setRefillRate] = useState(2); // tokens per second

  // Auth & RBAC State
  const [userRole, setUserRole] = useState('user'); // 'guest', 'user', 'admin'
  const [jwtExpired, setJwtExpired] = useState(false);

  // Caching & Database State
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [stampedeLock, setStampedeLock] = useState(true);
  const [cacheEntries, setCacheEntries] = useState(INITIAL_CACHE_KEYS);
  const [primaryDbAlive, setPrimaryDbAlive] = useState(true);
  const [replicaCount, setReplicaCount] = useState(2);

  // Scaling & Infrastructure State
  const [trafficRps, setTrafficRps] = useState(1450);
  const [autoScaleEnabled, setAutoScaleEnabled] = useState(true);
  const [manualPods, setManualPods] = useState(4);
  const [deployStrategy, setDeployStrategy] = useState('canary'); // 'rolling', 'blue-green', 'canary'
  const [canaryWeight, setCanaryWeight] = useState(15);

  // Live Packet Trace Simulator State
  const [activeScenario, setActiveScenario] = useState(REQUEST_SCENARIOS[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [traceSteps, setTraceSteps] = useState([]);
  const [currentHopIndex, setCurrentHopIndex] = useState(-1);
  const [traceSummary, setTraceSummary] = useState(null);
  const simulationLockRef = useRef(false);
  const simulationTimersRef = useRef([]);
  const ciTimersRef = useRef([]);

  useEffect(() => () => {
    simulationTimersRef.current.forEach(clearTimeout);
    ciTimersRef.current.forEach(clearTimeout);
  }, []);

  // Observability & Logs State
  const [logs, setLogs] = useState([
    {
      id: 'req-89f1a0',
      ts: new Date().toISOString().split('T')[1].slice(0, 12),
      level: 'INFO',
      service: 'api-gateway',
      status: 200,
      latency: '31ms',
      msg: 'GET /api/v1/products - Cache HIT (products:featured:v1)'
    },
    {
      id: 'req-42c9e1',
      ts: new Date().toISOString().split('T')[1].slice(0, 12),
      level: 'WARN',
      service: 'waf-edge',
      status: 403,
      latency: '4ms',
      msg: 'Blocked SQLi signature match rule_id=OWASP_942100 from 198.51.100.42'
    },
    {
      id: 'req-11b7d4',
      ts: new Date().toISOString().split('T')[1].slice(0, 12),
      level: 'INFO',
      service: 'k8s-hpa',
      status: 200,
      latency: '12ms',
      msg: 'ReplicaSet backend-api healthy: 4/4 pods ready'
    }
  ]);
  const [logFilter, setLogFilter] = useState('ALL');

  // CI/CD Pipeline State
  const [ciRunning, setCiRunning] = useState(false);
  const [ciStages, setCiStages] = useState([
    { id: 'lint', name: '1. Typecheck & ESLint', status: 'success', duration: '14s' },
    { id: 'unit', name: '2. Unit & Integration Tests', status: 'success', duration: '48s' },
    { id: 'sast', name: '3. SAST & Container Scan', status: 'success', duration: '32s' },
    { id: 'build', name: '4. Build OCI Docker Image', status: 'success', duration: '41s' },
    { id: 'deploy', name: '5. Canary Rollout & Smoke Test', status: 'success', duration: '25s' },
  ]);

  // --- TOKEN BUCKET REFILL TIMER ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTokensAvailable((prev) => Math.min(bucketCapacity, prev + refillRate));
    }, 1000);
    return () => clearInterval(interval);
  }, [bucketCapacity, refillRate]);

  // --- DYNAMIC COMPUTED METRICS ---
  const activePodCount = useMemo(() => {
    if (!autoScaleEnabled) return manualPods;
    return Math.max(2, Math.min(32, Math.ceil(trafficRps / 500)));
  }, [trafficRps, autoScaleEnabled, manualPods]);

  const cpuUtilization = useMemo(() => {
    const capacityPerPod = 600; // RPS per pod
    const totalCapacity = activePodCount * capacityPerPod;
    return Math.min(99, Math.round((trafficRps / totalCapacity) * 100));
  }, [trafficRps, activePodCount]);

  // Live Telemetry Time-Series Generator
  const [metricsHistory, setMetricsHistory] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      time: `${14 - i}s ago`,
      rps: 1400 + Math.round(Math.random() * 150),
      p99: 42 + Math.round(Math.random() * 12),
      errors: Math.round(Math.random() * 3),
    }))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setMetricsHistory((prev) => {
        const overloadFactor = cpuUtilization > 85 ? (cpuUtilization - 80) * 8 : 0;
        const dbPenalty = !primaryDbAlive ? 95 : 0;
        const cachePenalty = !cacheEnabled ? 55 : 0;
        const newP99 = Math.max(
          12,
          Math.round(28 + overloadFactor + dbPenalty + cachePenalty + (Math.random() * 14 - 7))
        );
        const newErrors =
          (!primaryDbAlive ? 18 : 0) +
          (cpuUtilization > 92 ? 12 : 0) +
          Math.round(Math.random() * 2);

        const next = [
          ...prev.slice(1),
          {
            time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
            rps: Math.max(50, trafficRps + Math.round(Math.random() * 120 - 60)),
            p99: newP99,
            errors: newErrors,
          },
        ];
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [trafficRps, cpuUtilization, primaryDbAlive, cacheEnabled]);

  // Helper to append structured logs
  const addLog = (level, service, status, latency, msg) => {
    const corrId = 'req-' + Math.random().toString(16).substring(2, 8);
    const ts = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs((prev) => [{ id: corrId, ts, level, service, status, latency, msg }, ...prev.slice(0, 49)]);
  };

  // --- BUILD TRACE HOPS FOR A SCENARIO ---
  const buildSimulationTrace = (scenario) => {
    const steps = [];
    let totalMs = 0;
    let finalStatus = 200;
    let outcomeText = '200 OK — Request Completed Successfully';

    const pushHop = (nodeId, status, ms, detail, isTerminal = false) => {
      totalMs += ms;
      steps.push({ nodeId, status, ms, detail, cumulativeMs: totalMs, isTerminal });
    };

    // 1. Client
    pushHop('client', 'ok', 4, `Initiated ${scenario.method} ${scenario.endpoint}`);

    // 2. CDN & Edge
    pushHop('cdn', 'ok', 7, 'TLS 1.3 Terminated at nearest PoP. Dynamic API route forwarded.');

    // 3. WAF & Security
    if (scenario.id === 'sqli' || scenario.id === 'xss') {
      const protectionEnabled = scenario.id === 'sqli' ? wafSqlEnabled : wafXssEnabled;
      const protectionName = scenario.id === 'sqli' ? 'SQL Injection' : 'Cross-Site Scripting';
      if (protectionEnabled) {
        pushHop('waf', 'error', 4, `BLOCKED: OWASP CRS ${protectionName} signature matched!`, true);
        return {
          steps,
          totalMs,
          finalStatus: 403,
          outcomeText: `403 Forbidden — Blocked at Edge by WAF ${scenario.id.toUpperCase()} Rule`,
        };
      }
      pushHop('waf', 'warn', 3, `WARNING: WAF ${protectionName} protection is disabled! Malicious payload passed.`);
    } else {
      pushHop('waf', 'ok', 3, 'Passed OWASP WAF inspection & DDoS reputation check.');
    }

    // 4. Rate Limiter (Token Bucket)
    if (scenario.id === 'ddos') setTokensAvailable(0);
    if (scenario.id === 'ddos' || tokensAvailable <= 0) {
      pushHop(
        'ratelimit',
        'error',
        2,
        `BLOCKED: Token bucket exhausted (0/${bucketCapacity} tokens). Retry-After: 1s`,
        true
      );
      return {
        steps,
        totalMs,
        finalStatus: 429,
        outcomeText: '429 Too Many Requests — Rate Limiter Throttled',
      };
    } else {
      setTokensAvailable((t) => Math.max(0, t - 1));
      pushHop(
        'ratelimit',
        'ok',
        2,
        `Allowed. Token consumed (${Math.max(0, tokensAvailable - 1)}/${bucketCapacity} remaining).`
      );
    }

    // 5. Auth & Permissions (JWT + RBAC)
    if (jwtExpired) {
      pushHop('auth', 'error', 5, 'BLOCKED: JWT Access Token exp claim is expired!', true);
      return {
        steps,
        totalMs,
        finalStatus: 401,
        outcomeText: '401 Unauthorized — JWT Token Expired',
      };
    }

    if (scenario.id === 'unauth' && userRole !== 'admin') {
      pushHop(
        'auth',
        'error',
        5,
        `BLOCKED: Role '${userRole}' lacks required 'admin:purge' permission scope.`,
        true
      );
      return {
        steps,
        totalMs,
        finalStatus: 403,
        outcomeText: `403 Forbidden — RBAC Denied for role '${userRole}'`,
      };
    }

    if (scenario.id === 'checkout' && userRole === 'guest') {
      pushHop('auth', 'error', 5, "BLOCKED: Role 'guest' must authenticate before checkout.", true);
      return {
        steps,
        totalMs,
        finalStatus: 401,
        outcomeText: '401 Unauthorized — Authentication Required',
      };
    }

    pushHop('auth', 'ok', 6, `JWT signature verified. Role '${userRole}' authorized.`);

    // 6. Load Balancer & Compute Pods
    const podLatency = cpuUtilization > 85 ? 45 : 14;
    pushHop(
      'lb',
      cpuUtilization > 85 ? 'warn' : 'ok',
      podLatency,
      `Routed to pod-backend-${Math.floor(Math.random() * activePodCount) + 1} (${deployStrategy} v2.4)`
    );

    // 7. Caching Tier (Redis)
    const cacheKey = scenario.id === 'cache_hit'
      ? 'products:featured:v1'
      : scenario.id === 'cache_miss'
      ? 'analytics:revenue-report:v1'
      : null;
    const cachedEntry = cacheKey ? cacheEntries.find((entry) => entry.key === cacheKey) : null;
    if (scenario.method === 'GET' && cacheEnabled && cachedEntry) {
      setCacheEntries((prev) => prev.map((entry) =>
        entry.key === cacheKey ? { ...entry, hits: entry.hits + 1 } : entry
      ));
      pushHop('cache', 'ok', 2, `CACHE HIT on key "${cacheKey}". Returning cached payload immediately!`, true);
      return {
        steps,
        totalMs,
        finalStatus: 200,
        outcomeText: `200 OK — Served from Redis Cache (${cacheKey})`,
      };
    }

    if (cacheEnabled) {
      pushHop(
        'cache',
        'warn',
        3,
        scenario.method === 'GET'
          ? `CACHE MISS${cacheKey ? ` for ${cacheKey}` : ''}. ${stampedeLock ? 'Acquired Mutex lock to prevent stampede.' : 'Querying DB without a stampede lock.'}`
          : 'Write operation: stale cache keys will be invalidated after DB commit.'
      );
    } else {
      pushHop('cache', 'warn', 1, 'Redis Cache Bypassed (Cache layer disabled in settings).');
    }

    // 8. Database Tier (PostgreSQL Primary / Read Replicas)
    if (!primaryDbAlive && replicaCount === 0) {
      pushHop('db', 'error', 120, 'CRITICAL: Primary PostgreSQL node down and no failover replicas available!', true);
      return {
        steps,
        totalMs,
        finalStatus: 503,
        outcomeText: '503 Service Unavailable — Database and failover replicas are unavailable',
      };
    }

    if (!primaryDbAlive && replicaCount > 0) {
      pushHop(
        'db',
        'warn',
        48,
        'Primary DB unreachable! Automatic failover promoted Read-Replica-1 to Primary.'
      );
    } else if (scenario.method === 'GET' && replicaCount > 0) {
      pushHop('db', 'ok', 34, `Executed SELECT on Read-Replica-${( steps.length % replicaCount ) + 1}.`);
    } else {
      pushHop('db', 'ok', 42, 'Executed ACID transaction on Primary PostgreSQL instance.');
    }

    // Populate cache after successful GET cache misses.
    if (scenario.method === 'GET' && cacheEnabled && cacheKey && !cachedEntry) {
      const entry = scenario.id === 'cache_hit'
        ? {
            key: cacheKey, ttl: 3600, size: '14.2 KB', hits: 0,
            value: '[{"id":"p1","name":"Mechanical Keyboard","price":149}]',
          }
        : {
            key: cacheKey, ttl: 300, size: '8.4 KB', hits: 0,
            value: '{"report":"revenue","period":"30d","total":48291.75}',
          };
      setCacheEntries((prev) => [...prev.filter((item) => item.key !== cacheKey), entry]);
    }

    // Checkout commits invalidate product and analytics cache entries.
    if (scenario.id === 'checkout') {
      setCacheEntries((prev) => prev.filter((entry) =>
        entry.key !== 'products:featured:v1' && entry.key !== 'analytics:revenue-report:v1'
      ));
    }

    // 9. Async Queue (for POST /checkout)
    if (scenario.id === 'checkout') {
      pushHop(
        'queue',
        'ok',
        11,
        'Published OrderCreated event to Kafka topic [orders.v1]. Workers processing invoice & email.',
        true
      );
    }

    return {
      steps,
      totalMs,
      finalStatus,
      outcomeText,
    };
  };

  // --- RUN LIVE SIMULATION ---
  const runScenarioSimulation = (scenario = activeScenario) => {
    if (simulationLockRef.current) return;
    simulationLockRef.current = true;
    simulationTimersRef.current.forEach(clearTimeout);
    simulationTimersRef.current = [];
    setActiveScenario(scenario);
    setIsSimulating(true);
    setCurrentHopIndex(-1);
    setTraceSummary(null);

    const result = buildSimulationTrace(scenario);
    setTraceSteps(result.steps);

    result.steps.forEach((step, idx) => {
      const timerId = setTimeout(() => {
        setCurrentHopIndex(idx);
        setSelectedNodeId(step.nodeId);

        if (idx === result.steps.length - 1) {
          setIsSimulating(false);
          simulationLockRef.current = false;
          setTraceSummary({
            status: result.finalStatus,
            totalMs: result.totalMs,
            text: result.outcomeText,
          });

          const logLevel =
            result.finalStatus >= 500 ? 'ERROR' : result.finalStatus >= 400 ? 'WARN' : 'INFO';
          const terminalNode = result.steps[result.steps.length - 1].nodeId;
          addLog(
            logLevel,
            terminalNode,
            result.finalStatus,
            `${result.totalMs}ms`,
            `${scenario.method} ${scenario.endpoint} -> ${result.outcomeText}`
          );
        }
      }, (idx + 1) * 340);
      simulationTimersRef.current.push(timerId);
    });
  };

  // --- RUN CI/CD PIPELINE SIMULATION ---
  const triggerCiPipeline = () => {
    if (ciRunning) return;
    setCiRunning(true);
    ciTimersRef.current.forEach(clearTimeout);
    ciTimersRef.current = [];
    setCiStages((prev) => prev.map((s) => ({ ...s, status: 'pending' })));
    addLog('INFO', 'ci-runner', 200, '0ms', 'Triggered GitHub Actions workflow:main-deploy #842');

    ciStages.forEach((stage, index) => {
      const runningTimer = setTimeout(() => {
        setCiStages((prev) =>
          prev.map((s, idx) =>
            idx === index ? { ...s, status: 'running' } : idx < index ? { ...s, status: 'success' } : s
          )
        );
      }, index * 650);
      ciTimersRef.current.push(runningTimer);

      const successTimer = setTimeout(() => {
        setCiStages((prev) =>
          prev.map((s, idx) => (idx <= index ? { ...s, status: 'success' } : s))
        );
        if (index === ciStages.length - 1) {
          setCiRunning(false);
          addLog('INFO', 'k8s-deploy', 200, '160s', `Successfully rolled out build #842 via ${deployStrategy} strategy`);
        }
      }, (index + 1) * 650);
      ciTimersRef.current.push(successTimer);
    });
  };

  // Decoded JWT Live Object
  const decodedJwt = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const scopes =
      userRole === 'admin'
        ? ['read:products', 'write:orders', 'admin:purge', 'metrics:read']
        : userRole === 'user'
        ? ['read:products', 'write:orders']
        : ['read:products'];

    return {
      header: { alg: 'RS256', typ: 'JWT', kid: 'key-2026-prod-01' },
      payload: {
        sub: userRole === 'guest' ? 'anon_session' : userRole === 'admin' ? 'usr_0001_root' : 'usr_99201',
        role: userRole,
        scopes,
        iat: now - 300,
        exp: jwtExpired ? now - 60 : now + 900,
        iss: 'https://auth.system-architect.io',
      },
    };
  }, [userRole, jwtExpired]);

  // Active System Alerts
  const activeAlerts = useMemo(() => {
    const list = [];
    if (!primaryDbAlive) {
      list.push({
        id: 'db-down',
        severity: 'critical',
        title: 'Primary PostgreSQL Instance Unreachable',
        desc: replicaCount > 0 ? 'Traffic failed over to Read-Replica-1.' : 'No replicas available! All writes failing with HTTP 500.',
      });
    }
    if (cpuUtilization > 85) {
      list.push({
        id: 'high-cpu',
        severity: 'warning',
        title: `High Pod CPU Saturation (${cpuUtilization}%)`,
        desc: autoScaleEnabled ? 'HPA scaling pods up to absorb load.' : 'Auto-scaler disabled! Enable HPA or increase pods manually.',
      });
    }
    if (!wafSqlEnabled) {
      list.push({
        id: 'waf-off',
        severity: 'warning',
        title: 'Edge WAF SQL Injection Filter Disabled',
        desc: 'Database is exposed to unvalidated SQLi payloads.',
      });
    }
    if (tokensAvailable === 0) {
      list.push({
        id: 'rate-exhausted',
        severity: 'warning',
        title: 'API Gateway Rate Limit Bucket Exhausted',
        desc: 'Incoming requests are receiving HTTP 429 until token refill.',
      });
    }
    return list;
  }, [primaryDbAlive, replicaCount, cpuUtilization, autoScaleEnabled, wafSqlEnabled, tokensAvailable]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* TOP GLOBAL STATUS HEADER */}
      <header className="border-b border-slate-800/90 bg-slate-900/75 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  SystemDesign<span className="text-indigo-400">.OS</span>
                </h1>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Full-Stack Iceberg Simulator
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Interactive Production Architecture: Edge CDN • WAF • Rate Limiting • JWT/RBAC • K8s • Redis • Postgres • Observability
              </p>
            </div>
          </div>

          {/* Live System Health Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeAlerts.some(a => a.severity === 'critical') ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-slate-400">Traffic:</span>
              <span className="font-mono font-semibold text-white">{trafficRps.toLocaleString()} RPS</span>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">K8s Pods:</span>
              <span className="font-mono font-semibold text-cyan-300">{activePodCount} active ({cpuUtilization}% CPU)</span>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Role:</span>
              <span className="font-mono font-semibold uppercase text-amber-300">{userRole}</span>
            </div>
          </div>
        </div>

        {/* Active Alerts Banner */}
        {activeAlerts.length > 0 && (
          <div className="bg-rose-950/60 border-t border-rose-500/30 px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
                <span className="font-semibold">{activeAlerts[0].title}:</span>
                <span className="text-rose-300/90">{activeAlerts[0].desc}</span>
              </div>
              {activeAlerts.length > 1 && (
                <span className="text-[11px] font-mono text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded">
                  +{activeAlerts.length - 1} more active alert(s)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar border-t border-slate-800/60">
          {[
            { id: 'simulator', label: '1. Architecture & Packet Tracer', icon: Activity },
            { id: 'security', label: '2. Security, WAF & Rate Limiting', icon: Shield },
            { id: 'auth', label: '3. Auth (JWT & RBAC)', icon: Lock },
            { id: 'data', label: '4. Caching, DB & Storage', icon: Database },
            { id: 'scaling', label: '5. Scaling, K8s & Chaos', icon: Server },
            { id: 'observability', label: '6. Observability, Logs & CI/CD', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* =====================================================================
            TAB 1: INTERACTIVE ARCHITECTURE MAP & LIVE PACKET SIMULATOR
           ===================================================================== */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* Top Request Scenario Launcher */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-indigo-400" />
                    End-to-End Request Lifecycle Simulator
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select a scenario to fire a live request through every layer of the stack. Changes you make in the Security, Auth, Cache, or DB tabs directly affect how requests behave here!
                  </p>
                </div>

                {/* Quick System Toggles Bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => setCacheEnabled(!cacheEnabled)}
                    className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                      cacheEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Redis Cache: {cacheEnabled ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() => setWafSqlEnabled(!wafSqlEnabled)}
                    className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                      wafSqlEnabled
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    WAF SQLi Filter: {wafSqlEnabled ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() => setUserRole(userRole === 'admin' ? 'user' : userRole === 'user' ? 'guest' : 'admin')}
                    className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300 font-medium flex items-center gap-1.5 transition"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Role: {userRole.toUpperCase()} (Click to cycle)
                  </button>
                </div>
              </div>

              {/* Scenario Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {REQUEST_SCENARIOS.map((sc) => {
                  const isSelected = activeScenario.id === sc.id;
                  return (
                    <div
                      key={sc.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Run scenario: ${sc.name}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          runScenarioSimulation(sc);
                        }
                      }}
                      onClick={() => runScenarioSimulation(sc)}
                      className={`cursor-pointer rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/70 shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-xs font-bold text-white">{sc.name}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.badgeColor}`}>
                            {sc.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{sc.description}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-500 truncate">{sc.endpoint}</span>
                        <span className="text-indigo-400 font-semibold flex items-center gap-1 shrink-0">
                          Fire Packet <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive 9-Layer Architecture Pipeline Graph */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Visual Pipeline Nodes */}
              <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Production Architecture Pipeline (Click any layer to inspect)
                  </h3>
                  {isSimulating && (
                    <span className="text-xs text-indigo-400 font-mono flex items-center gap-1.5 animate-pulse">
                      <Radio className="w-3.5 h-3.5" /> Tracing packet hops...
                    </span>
                  )}
                </div>

                {/* Node Grid Pipeline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ARCHITECTURE_NODES.map((node, index) => {
                    const Icon = node.icon;
                    const traceStepIndex = traceSteps.findIndex((s) => s.nodeId === node.id);
                    const stepData =
                      traceStepIndex !== -1 && traceStepIndex <= currentHopIndex
                        ? traceSteps[traceStepIndex]
                        : null;
                    const isCurrentHop =
                      traceStepIndex !== -1 && traceStepIndex === currentHopIndex && isSimulating;

                    let statusClasses = 'border-slate-800 bg-slate-950/70';
                    if (stepData) {
                      if (stepData.status === 'ok') {
                        statusClasses = 'border-emerald-500/60 bg-emerald-950/25';
                      } else if (stepData.status === 'warn') {
                        statusClasses = 'border-amber-500/60 bg-amber-950/25';
                      } else if (stepData.status === 'error') {
                        statusClasses = 'border-rose-500/80 bg-rose-950/35';
                      }
                    }

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`relative rounded-xl p-3.5 border transition-all cursor-pointer ${statusClasses} ${
                          selectedNodeId === node.id ? 'ring-2 ring-indigo-400' : ''
                        } ${isCurrentHop ? 'scale-[1.02] shadow-lg shadow-indigo-500/20' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-slate-800/90 text-indigo-300">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                                Hop {index + 1} • {node.category}
                              </span>
                              <h4 className="text-xs font-bold text-white">{node.name}</h4>
                            </div>
                          </div>

                          {stepData && (
                            <span
                              className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                                stepData.status === 'ok'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : stepData.status === 'warn'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              +{stepData.ms}ms
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 mt-2">{node.sub}</p>

                        {stepData && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-200 flex items-start gap-1.5">
                            {stepData.status === 'ok' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                            {stepData.status === 'warn' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            )}
                            {stepData.status === 'error' && (
                              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-tight">{stepData.detail}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Final Response Banner */}
                {traceSummary && (
                  <div
                    className={`rounded-xl p-4 border flex flex-wrap items-center justify-between gap-4 ${
                      traceSummary.status === 200
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                        : traceSummary.status >= 500
                        ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                        : 'bg-amber-950/35 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold px-2.5 py-1 rounded bg-black/30">
                        HTTP {traceSummary.status}
                      </span>
                      <div>
                        <div className="text-sm font-bold">{traceSummary.text}</div>
                        <div className="text-xs opacity-80">
                          Endpoint: {activeScenario.method} {activeScenario.endpoint}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold">
                      Total Latency: {traceSummary.totalMs} ms
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Hop-by-Hop Waterfall & Deep Node Inspector */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Request Latency Waterfall
                  </h3>

                  {traceSteps.length === 0 ? (
                    <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                      Click any scenario card above to trace a live packet across the infrastructure stack.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {traceSteps.slice(0, currentHopIndex + 1).map((step, i) => {
                        const nodeObj = ARCHITECTURE_NODES.find((n) => n.id === step.nodeId);
                        const widthPct = Math.min(100, Math.max(12, Math.round((step.ms / 50) * 100)));
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-200">
                                {i + 1}. {nodeObj?.name}
                              </span>
                              <span className="font-mono text-slate-400">
                                {step.ms}ms (T+{step.cumulativeMs}ms)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  step.status === 'ok'
                                    ? 'bg-emerald-400'
                                    : step.status === 'warn'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Deep-Dive Layer Blueprint Box */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase text-indigo-400">
                    Layer Engineering Spec
                  </div>
                  {(() => {
                    const node = ARCHITECTURE_NODES.find((n) => n.id === selectedNodeId) || ARCHITECTURE_NODES[0];
                    return (
                      <>
                        <div className="text-sm font-bold text-white">{node.name}</div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {node.id === 'client' &&
                            'Executes React Hydration, manages client state, and enforces Core Web Vitals budgets (LCP < 2.5s, CLS < 0.1).'}
                          {node.id === 'cdn' &&
                            'Anycast DNS routes users to nearest edge PoP. Serves static bundles with immutable Cache-Control headers.'}
                          {node.id === 'waf' &&
                            'Inspects HTTP headers, query strings, and JSON bodies against OWASP Top 10 signatures (SQLi, XSS) & mitigates L7 DDoS.'}
                          {node.id === 'ratelimit' &&
                            'Executes atomic Redis Lua scripts implementing Token Bucket & Sliding Window algorithms to prevent API abuse.'}
                          {node.id === 'auth' &&
                            'Validates asymmetric RS256 JWT tokens via JWKS public keys and evaluates Role-Based Access Control (RBAC) scopes.'}
                          {node.id === 'lb' &&
                            'Envoy Ingress distributes requests across Kubernetes pods managed by Horizontal Pod Autoscaler (HPA).'}
                          {node.id === 'cache' &&
                            'Sub-millisecond Redis cluster using Cache-Aside + Mutex locks to prevent Cache Stampedes on cold keys.'}
                          {node.id === 'db' &&
                            'ACID-compliant Primary PostgreSQL for writes with asynchronous streaming replication to Read Replicas.'}
                          {node.id === 'queue' &&
                            'Decouples heavy tasks (emails, webhooks, PDF generation) via Apache Kafka topics with Dead-Letter Queue (DLQ) retries.'}
                        </p>
                      </>                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: RATE LIMITING & WAF SECURITY SANDBOX
           ===================================================================== */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Bucket Rate Limiter Interactive Sandbox */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    Distributed Redis Token Bucket Rate Limiter
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rapidly click "Send API Request" to drain the token bucket and trigger HTTP 429 throttling.
                  </p>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {tokensAvailable} / {bucketCapacity} Tokens
                </span>
              </div>

              {/* Visual Token Bucket Gauge */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Live Bucket Capacity</span>
                  <span className="font-mono text-emerald-400">Refilling +{refillRate} token(s)/sec</span>
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: bucketCapacity }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-7 rounded-md transition-all duration-200 ${
                        idx < tokensAvailable
                          ? 'bg-gradient-to-t from-indigo-600 to-cyan-400 shadow-sm shadow-cyan-500/30'
                          : 'bg-slate-800/70 border border-slate-700/50'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (tokensAvailable > 0) {
                        setTokensAvailable((prev) => prev - 1);
                        addLog('INFO', 'rate-limiter', 200, '2ms', `Token consumed (${tokensAvailable - 1}/${bucketCapacity} left)`);
                      } else {
                        addLog('WARN', 'rate-limiter', 429, '1ms', 'HTTP 429 Too Many Requests: Bucket empty');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition"
                  >
                    <Zap className="w-4 h-4" /> Send Single Request (-1 Token)
                  </button>

                  <button
                    onClick={() => {
                      setTokensAvailable(0);
                      addLog('WARN', 'rate-limiter', 429, '1ms', 'Burst spike exhausted all tokens -> HTTP 429');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs transition"
                  >
                    Simulate Burst Attack (Drain All)
                  </button>
                </div>
              </div>

              {/* Rate Limiter Sliders */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Bucket Max Capacity (Burst Size)</span>
                    <span className="font-mono text-indigo-300">{bucketCapacity} tokens</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={bucketCapacity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBucketCapacity(val);
                      setTokensAvailable((t) => Math.min(val, t));
                    }}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Token Refill Rate (Sustained Rate)</span>
                    <span className="font-mono text-indigo-300">{refillRate} tokens / sec</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={refillRate}
                    onChange={(e) => setRefillRate(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Edge WAF Rules Configuration */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Edge Web Application Firewall (WAF) Rules
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle OWASP Core Rule Set (CRS) filters at the CDN Edge and test malicious payloads.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">SQL Injection (SQLi) Filter</div>
                    <div className="text-xs text-slate-400">
                      Blocks tautologies (`OR 1=1`), `UNION SELECT`, and stacked queries.
                    </div>
                  </div>
                  <button
                    onClick={() => setWafSqlEnabled(!wafSqlEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      wafSqlEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {wafSqlEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Cross-Site Scripting (XSS) Filter</div>
                    <div className="text-xs text-slate-400">
                      Sanitizes inline {'<script>'} tags and `onerror=` DOM event handlers.
                    </div>
                  </div>
                  <button
                    onClick={() => setWafXssEnabled(!wafXssEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      wafXssEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {wafXssEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/25 border border-indigo-500/30 text-xs space-y-2">
                <div className="font-semibold text-indigo-300">Defense-in-Depth Architecture Note:</div>
                <p className="text-slate-300 leading-relaxed">
                  Even if the Edge WAF is disabled or bypassed, production backends use parameterized prepared statements (`SELECT * FROM users WHERE id = $1`) and Content-Security-Policy (CSP) headers as a secondary defense barrier.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: AUTH & PERMISSIONS (JWT + RBAC INSPECTOR)
           ===================================================================== */}
        {activeTab === 'auth' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Role & Token Controls */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Identity, OAuth 2.0 / OIDC & RBAC Simulator
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Switch active session roles and inspect how the API Gateway validates JWT claims and permission scopes.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'guest', title: 'Guest (Anonymous)', desc: 'Read-only public catalog' },
                  { id: 'user', title: 'Authenticated User', desc: 'Can browse & checkout' },
                  { id: 'admin', title: 'System Admin', desc: 'Full RBAC privileges' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setUserRole(r.id)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      userRole === r.id
                        ? 'bg-amber-500/15 border-amber-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase text-amber-300">{r.id}</div>
                    <div className="text-xs font-semibold text-white mt-0.5">{r.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{r.desc}</div>
                  </button>
                ))}
              </div>

              {/* Token Expiration Toggle */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Simulate Expired JWT Access Token</div>
                  <div className="text-xs text-slate-400">
                    Sets the JWT `exp` timestamp in the past to trigger HTTP 401 Unauthorized.
                  </div>
                </div>
                <button
                  onClick={() => setJwtExpired(!jwtExpired)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    jwtExpired
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {jwtExpired ? 'TOKEN EXPIRED (401)' : 'TOKEN VALID'}
                </button>
              </div>

              {/* Endpoint Permission Matrix */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-slate-400">Live RBAC Policy Evaluation Matrix</div>
                {[
                  { route: 'GET /api/v1/products', scope: 'read:products', allowed: !jwtExpired },
                  {
                    route: 'POST /api/v1/checkout',
                    scope: 'write:orders',
                    allowed: !jwtExpired && (userRole === 'user' || userRole === 'admin'),
                  },
                  {
                    route: 'DELETE /api/v1/admin/purge-users',
                    scope: 'admin:purge',
                    allowed: !jwtExpired && userRole === 'admin',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-white">{item.route}</span>
                      <span className="ml-2 text-[11px] font-mono text-slate-400">
                        requires [{item.scope}]
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded ${
                        item.allowed
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {item.allowed ? '200 ALLOWED' : jwtExpired ? '401 EXPIRED' : '403 DENIED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Decoded JWT Inspector */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Live Decoded JSON Web Token (RS256)
              </h2>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase text-rose-400 mb-1">HEADER (Algorithm & Key ID)</div>
                  <pre className="text-slate-200 overflow-x-auto">
                    {JSON.stringify(decodedJwt.header, null, 2)}
                  </pre>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase text-purple-400 mb-1">
                    PAYLOAD (Claims & RBAC Scopes)
                  </div>
                  <pre className="text-slate-200 overflow-x-auto">
                    {JSON.stringify(decodedJwt.payload, null, 2)}
                  </pre>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase text-cyan-400 mb-1">
                    ASYMMETRIC SIGNATURE (Verified via JWKS Endpoint)
                  </div>
                  <div className="text-slate-400 break-all">
                    RSASHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), publicKey_2026_01)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: CACHING (REDIS), DATABASES (POSTGRES) & OBJECT STORAGE
           ===================================================================== */}
        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Redis In-Memory Cache Explorer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Redis In-Memory Cache Cluster (Cache-Aside)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inspect cached keys, flush Redis memory to force cold database reads, or toggle Stampede Mutex locking.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCacheEntries([]);
                    addLog('WARN', 'redis-cluster', 200, '1ms', 'Executed FLUSHALL: All cache keys evicted');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> FLUSHALL Cache
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCacheEnabled(!cacheEnabled)}
                  className={`p-3 rounded-xl border text-left ${
                    cacheEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Cache-Aside Layer</div>
                  <div className="text-[11px] mt-0.5">{cacheEnabled ? 'Active (2ms latency)' : 'Disabled (Hits DB)'}</div>
                </button>

                <button
                  onClick={() => setStampedeLock(!stampedeLock)}
                  className={`p-3 rounded-xl border text-left ${
                    stampedeLock
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Cache Stampede Mutex</div>
                  <div className="text-[11px] mt-0.5">{stampedeLock ? 'Enabled (Singleflight)' : 'Disabled'}</div>
                </button>
              </div>

              {/* Redis Key Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Active Redis Keys ({cacheEntries.length})</span>
                  <button
                    onClick={() => setCacheEntries(INITIAL_CACHE_KEYS)}
                    className="text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Warm Cache
                  </button>
                </div>

                {cacheEntries.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    Redis cache is currently empty (Cold State). Next GET request will experience a Cache Miss and query PostgreSQL.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cacheEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-300">{entry.key}</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            TTL: {entry.ttl}s • Hits: {entry.hits} • {entry.size}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">{entry.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PostgreSQL Primary + Read Replicas Explorer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  PostgreSQL Replication & High-Availability Topology
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Writes go to Primary Node; `SELECT` queries balance across Read Replicas. Test failover by taking the Primary node offline.
                </p>
              </div>

              {/* Primary Node Status Card */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  primaryDbAlive
                    ? 'bg-emerald-950/25 border-emerald-500/40'
                    : 'bg-rose-950/35 border-rose-500/50'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    pg-primary-01 (us-east-1a)
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        primaryDbAlive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {primaryDbAlive ? 'ONLINE (Read/Write)' : 'OFFLINE (Chaos Simulated)'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    PgBouncer Connection Pool: 85 / 500 active connections • WAL Replication Streaming
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPrimaryDbAlive(!primaryDbAlive);
                    addLog(
                      primaryDbAlive ? 'ERROR' : 'INFO',
                      'postgres-ha',
                      primaryDbAlive ? 503 : 200,
                      '15ms',
                      primaryDbAlive
                        ? 'CHAOS: pg-primary-01 terminated! Initiating replica failover.'
                        : 'pg-primary-01 restored and healthy.'
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {primaryDbAlive ? 'Simulate Primary Crash' : 'Restore Primary Node'}
                </button>
              </div>

              {/* Read Replicas Control */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Active Read Replicas (Async Streaming Replication)</span>
                  <span className="font-mono text-cyan-300">{replicaCount} Replicas</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={replicaCount}
                  onChange={(e) => setReplicaCount(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  {Array.from({ length: replicaCount }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-cyan-300">pg-replica-0{idx + 1}</div>
                        <div className="text-[11px] text-slate-400">Replication Lag: {4 + idx * 3}ms</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        {!primaryDbAlive && idx === 0 ? 'PROMOTED PRIMARY' : 'READ-ONLY'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: SCALING, KUBERNETES HPA & DEPLOYMENT STRATEGIES
           ===================================================================== */}
        {activeTab === 'scaling' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Load & Kubernetes HPA Controller */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Kubernetes Horizontal Pod Autoscaler (HPA)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag the Concurrent Traffic slider to watch Kubernetes scale backend container replicas dynamically.
                  </p>
                </div>
                <button
                  onClick={() => setAutoScaleEnabled(!autoScaleEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    autoScaleEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}
                >
                  HPA: {autoScaleEnabled ? 'AUTO' : 'MANUAL'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Incoming Global Traffic Load (RPS)</span>
                    <span className="font-mono font-bold text-white">{trafficRps.toLocaleString()} req/sec</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="15000"
                    step="100"
                    value={trafficRps}
                    onChange={(e) => setTrafficRps(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                {!autoScaleEnabled && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-amber-300">Manual Pod Replica Count</span>
                      <span className="font-mono font-bold text-amber-300">{manualPods} pods</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="24"
                      value={manualPods}
                      onChange={(e) => setManualPods(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Pod Grid Visualizer */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Active K8s Replicas ({activePodCount} Pods)</span>
                  <span
                    className={`font-mono font-bold ${
                      cpuUtilization > 85 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    Avg Pod CPU: {cpuUtilization}%
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Array.from({ length: activePodCount }).map((_, idx) => {
                    const isCanary =
                      deployStrategy === 'canary' &&
                      idx < Math.max(1, Math.round((activePodCount * canaryWeight) / 100));
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-center ${
                          isCanary
                            ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                            : 'bg-slate-900 border-slate-700 text-cyan-300'
                        }`}
                      >
                        <Server className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-[10px] font-mono">
                          {isCanary ? 'v2.5-cnry' : 'v2.4-prod'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Zero-Downtime Deployment Strategy Selector */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  Zero-Downtime Deployment Strategies
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure how new container builds are promoted into production without dropping active user connections.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'canary', name: 'Canary Rollout', desc: 'Route % of live traffic to v2.5 first' },
                  { id: 'blue-green', name: 'Blue / Green', desc: 'Instant load balancer cutover' },
                  { id: 'rolling', name: 'Rolling Update', desc: 'Replace pods gradually one by one' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setDeployStrategy(st.id)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      deployStrategy === st.id
                        ? 'bg-purple-500/15 border-purple-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{st.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{st.desc}</div>
                  </button>
                ))}
              </div>

              {deployStrategy === 'canary' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Canary Traffic Split Weight (v2.5-canary)</span>
                    <span className="font-mono text-purple-300">{canaryWeight}% Canary / {100 - canaryWeight}% Stable</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={canaryWeight}
                    onChange={(e) => setCanaryWeight(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 6: OBSERVABILITY, TELEMETRY, LOGS & CI/CD PIPELINE
           ===================================================================== */}
        {activeTab === 'observability' && (
          <div className="space-y-6">
            {/* RED Metrics Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      P99 Latency Telemetry (ms)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Reacts in real time to Cache Misses, CPU saturation, and DB failovers.
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-indigo-300">
                    {metricsHistory[metricsHistory.length - 1]?.p99} ms
                  </span>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metricsHistory}>
                      <defs>
                        <linearGradient id="p99Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="p99" stroke="#818cf8" fill="url(#p99Grad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Interactive CI/CD Pipeline Runner */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-emerald-400" />
                      Automated CI/CD Deployment Pipeline
                    </h3>
                    <p className="text-xs text-slate-400">
                      GitHub Actions -&gt; SAST Security Scan -&gt; Docker OCI Build -&gt; K8s Canary Rollout
                    </p>
                  </div>
                  <button
                    onClick={triggerCiPipeline}
                    disabled={ciRunning}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {ciRunning ? 'Pipeline Running...' : 'Trigger CI/CD Deploy'}
                  </button>
                </div>

                <div className="space-y-2">
                  {ciStages.map((stage) => (
                    <div
                      key={stage.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {stage.status === 'success' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                        {stage.status === 'running' && (
                          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                        )}
                        {stage.status === 'pending' && (
                          <Clock className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="font-medium text-slate-200">{stage.name}</span>
                      </div>
                      <span className="font-mono text-slate-400">{stage.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Structured JSON Log Stream */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Centralized Structured Log Stream (OpenTelemetry Correlation IDs)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLogFilter(lvl)}
                      className={`px-2.5 py-1 rounded-md font-mono font-semibold ${
                        logFilter === lvl
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs space-y-1.5 max-h-64 overflow-y-auto">
                {logs
                  .filter((l) => logFilter === 'ALL' || l.level === logFilter)
                  .map((log, index) => (
                    <div
                      key={`${log.id}-${index}`}
                      className="flex flex-wrap items-center gap-2 py-1 border-b border-slate-900/80 last:border-0"
                    >
                      <span className="text-slate-500">{log.ts}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.level === 'INFO'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : log.level === 'WARN'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-indigo-400">[{log.id}]</span>
                      <span className="text-cyan-400">{log.service}</span>
                      <span className="text-slate-400">({log.latency})</span>
                      <span className="text-slate-200">{log.msg}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}