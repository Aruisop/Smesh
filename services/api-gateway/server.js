/**
 * SentinelMesh API Gateway v3.0
 *
 * Production-grade Express.js server providing:
 * - GitHub OAuth 2.0 with CSRF state protection
 * - JWT session management
 * - Socket.IO real-time event streaming
 * - REST endpoints for dashboard data
 * - Redis-backed data retrieval
 * - MITRE ATT&CK + O-RAN threat classification
 * - O1 telemetry & A1 policy audit endpoints
 * - RAN health monitoring & security posture
 * - Rate limiting & structured logging
 *
 * @author SentinelMesh Team
 * @version 3.0.0
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { Server: SocketServer } = require("socket.io");
const { createClient } = require("redis");
const pino = require("pino");

// ──────────────────────── Logger ────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

const app = express();
const server = http.createServer(app);

// ──────────────────────── Config ────────────────────────
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const JWT_SECRET = process.env.JWT_SECRET || "sentinelmesh_jwt_secret_dev";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/api/auth/github/callback";

// ──────────────────────── Middleware ────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json());

const corsOptions = {
  origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true,
};
app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip,
    }, `${req.method} ${req.url} ${res.statusCode}`);
  });
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, please try again later." },
});

app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);

// ──────────────────────── Socket.IO ────────────────────────
const io = new SocketServer(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user;
    next();
  });
});

io.on("connection", (socket) => {
  logger.info({ userId: socket.user.login }, "Socket.IO client connected");

  socket.on("disconnect", () => {
    logger.info({ userId: socket.user.login }, "Socket.IO client disconnected");
  });
});

// CSRF state store
const oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates.entries()) {
    if (now - val.created > 10 * 60 * 1000) oauthStates.delete(key);
  }
}, 5 * 60 * 1000);

// ──────────────────────── Redis ────────────────────────
let redisClient;
let redisSub; // Subscribe client for Pub/Sub

async function connectRedis() {
  redisClient = createClient({ url: `redis://${REDIS_HOST}:${REDIS_PORT}` });
  redisSub = createClient({ url: `redis://${REDIS_HOST}:${REDIS_PORT}` });

  redisClient.on("error", (err) => logger.error({ err: err.message }, "Redis error"));
  redisClient.on("connect", () => logger.info("Connected to Redis (main)"));
  redisSub.on("error", (err) => logger.error({ err: err.message }, "Redis sub error"));

  let retries = 0;
  while (retries < 30) {
    try {
      await redisClient.connect();
      await redisSub.connect();

      // Subscribe to real-time events channel
      await redisSub.subscribe("sentinel:events", (message) => {
        try {
          const event = JSON.parse(message);
          io.emit("threat:new", event);
        } catch {}
      });

      await redisSub.subscribe("sentinel:stats", (message) => {
        try {
          const stats = JSON.parse(message);
          io.emit("stats:update", stats);
        } catch {}
      });

      logger.info("Redis Pub/Sub subscriptions active");
      return;
    } catch (err) {
      retries++;
      logger.warn(`Waiting for Redis... (attempt ${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  logger.fatal("Failed to connect to Redis after 30 retries.");
  process.exit(1);
}

// ──────────────────────── JWT Middleware ────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];
  const tokenFromCookie = req.cookies && req.cookies.sentinel_token;
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

// ──────────────────────── MITRE ATT&CK + O-RAN Mapping ────────────────────────
const MITRE_ATTACK = {
  brute_force: {
    tactic: "Credential Access",
    technique: "T1110",
    techniqueName: "Brute Force",
    subtechnique: "T1110.001",
    subtechniqueName: "Password Guessing",
    mitigations: ["M1032 - Multi-factor Authentication", "M1036 - Account Use Policies"],
    domain: "network",
  },
  port_scan: {
    tactic: "Discovery",
    technique: "T1046",
    techniqueName: "Network Service Discovery",
    subtechnique: null,
    subtechniqueName: null,
    mitigations: ["M1030 - Network Segmentation", "M1031 - Network Intrusion Prevention"],
    domain: "network",
  },
  dns_anomaly: {
    tactic: "Command and Control",
    technique: "T1071",
    techniqueName: "Application Layer Protocol",
    subtechnique: "T1071.004",
    subtechniqueName: "DNS",
    mitigations: ["M1031 - Network Intrusion Prevention", "M1037 - Filter Network Traffic"],
    domain: "network",
  },
  packet_spike: {
    tactic: "Impact",
    technique: "T1498",
    techniqueName: "Network Denial of Service",
    subtechnique: "T1498.001",
    subtechniqueName: "Direct Network Flood",
    mitigations: ["M1037 - Filter Network Traffic", "DS0029 - Network Traffic Analysis"],
    domain: "network",
  },
  // ─── O-RAN / Telecom-Specific MITRE FiGHT Mappings ───
  rogue_basestation: {
    tactic: "Initial Access",
    technique: "FGT1583",
    techniqueName: "Rogue Base Station",
    subtechnique: "FGT1583.501",
    subtechniqueName: "Fake gNB Impersonation",
    mitigations: [
      "FGM5003 - Mutual Authentication (TS 33.501)",
      "FGM5009 - Cell Identity Verification",
      "FGM5012 - Radio Fingerprinting",
    ],
    domain: "telecom",
    oranRef: "O-RAN.WG11.Threat-Model v04.00",
  },
  handover_hijack: {
    tactic: "Lateral Movement",
    technique: "FGT1599",
    techniqueName: "Handover Hijacking",
    subtechnique: "FGT1599.001",
    subtechniqueName: "A3-Event Manipulation",
    mitigations: [
      "FGM5015 - Handover Authentication",
      "FGM5018 - X2/Xn Interface Verification",
      "A1-POL - Block Unverified Handover Sources",
    ],
    domain: "telecom",
    oranRef: "3GPP TS 33.501 §6.7",
  },
  signaling_storm: {
    tactic: "Impact",
    technique: "FGT1498",
    techniqueName: "Signaling Plane DoS",
    subtechnique: "FGT1498.502",
    subtechniqueName: "NAS/RRC Flooding",
    mitigations: [
      "FGM5021 - Signaling Rate Limiting",
      "FGM5024 - AMF Overload Control",
      "A1-POL - Dynamic RRC Throttling",
    ],
    domain: "telecom",
    oranRef: "O-RAN.WG3.RICAPP-R003-v03.00",
  },
  unauthorized_slice_access: {
    tactic: "Defense Evasion",
    technique: "FGT1562",
    techniqueName: "Network Slice Isolation Bypass",
    subtechnique: "FGT1562.501",
    subtechniqueName: "S-NSSAI Spoofing",
    mitigations: [
      "FGM5030 - Slice Authentication (NSSAAF)",
      "FGM5033 - Zero-Trust Slice Policy",
      "A1-POL - Slice Admission Control",
    ],
    domain: "telecom",
    oranRef: "3GPP TS 33.813 §5.2",
  },
  imsi_catcher: {
    tactic: "Collection",
    technique: "FGT1040",
    techniqueName: "IMSI/SUPI Interception",
    subtechnique: "FGT1040.501",
    subtechniqueName: "5G-to-4G Downgrade",
    mitigations: [
      "FGM5006 - SUPI Concealment (SUCI)",
      "FGM5009 - Cell Identity Verification",
      "FGM5036 - Bidding-Down Prevention",
    ],
    domain: "telecom",
    oranRef: "3GPP TS 33.501 §6.12",
  },
  normal: {
    tactic: "None",
    technique: "N/A",
    techniqueName: "Normal Traffic",
    subtechnique: null,
    subtechniqueName: null,
    mitigations: [],
    domain: "network",
  },
};

// ──────────────────────── Auth Routes ────────────────────────

app.get("/api/auth/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GitHub OAuth not configured. Use demo login." });
  }

  const state = crypto.randomBytes(32).toString("hex");
  oauthStates.set(state, { created: Date.now() });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "read:user user:email",
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get("/api/auth/github/callback", async (req, res) => {
  const { code, state, error: ghError } = req.query;

  if (ghError) {
    logger.error({ error: ghError }, "GitHub OAuth error");
    return res.redirect(`${FRONTEND_URL}/login?error=${ghError}`);
  }

  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=no_code`);

  if (!state || !oauthStates.has(state)) {
    logger.warn("Invalid OAuth state parameter");
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }
  oauthStates.delete(state);

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: GITHUB_CALLBACK_URL },
      { headers: { Accept: "application/json" }, timeout: 10000 }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      const errMsg = tokenResponse.data.error_description || "token_exchange_failed";
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(errMsg)}`);
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    const ghUser = userResponse.data;
    const jwtPayload = {
      id: ghUser.id,
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatar_url: ghUser.avatar_url,
      email: ghUser.email,
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.cookie("sentinel_token", token, {
      httpOnly: false, secure: false, maxAge: 24 * 60 * 60 * 1000, sameSite: "lax", path: "/",
    });

    logger.info({ user: ghUser.login }, "OAuth authentication successful");
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    logger.error({ err: err.message }, "OAuth error");
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
});

app.post("/api/auth/demo", (req, res) => {
  const jwtPayload = {
    id: 1,
    login: "demo_analyst",
    name: "SOC Analyst (Demo)",
    avatar_url: "",
    email: "analyst@sentinelmesh.dev",
    role: "analyst",
  };

  const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.cookie("sentinel_token", token, {
    httpOnly: false, secure: false, maxAge: 24 * 60 * 60 * 1000, sameSite: "lax", path: "/",
  });
  res.json({ token, user: jwtPayload });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("sentinel_token", { path: "/" });
  res.json({ message: "Logged out" });
});

// ──────────────────────── Data Endpoints ────────────────────────

app.get("/api/alerts", authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const severity = req.query.severity;

    const rawAlerts = await redisClient.zRange("alerts_by_score", offset, offset + limit - 1, { REV: true });

    let alerts = rawAlerts.map((raw) => {
      try {
        const alert = JSON.parse(raw);
        // Enrich with MITRE ATT&CK data
        const mitre = MITRE_ATTACK[alert.event_type] || MITRE_ATTACK.normal;
        return { ...alert, mitre };
      } catch { return null; }
    }).filter(Boolean);

    if (severity) {
      alerts = alerts.filter((a) => a.severity === severity.toUpperCase());
    }

    const total = await redisClient.zCard("alerts_by_score");
    res.json({ alerts, total, limit, offset });
  } catch (err) {
    logger.error({ err: err.message }, "/alerts error");
    res.json({ alerts: [], total: 0, limit: 50, offset: 0 });
  }
});

app.get("/api/traffic", authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const rawTraffic = await redisClient.lRange("recent_traffic", 0, limit - 1);
    const traffic = rawTraffic.map((raw) => {
      try { return JSON.parse(raw); } catch { return null; }
    }).filter(Boolean);
    res.json({ traffic, count: traffic.length });
  } catch (err) {
    logger.error({ err: err.message }, "/traffic error");
    res.json({ traffic: [], count: 0 });
  }
});

app.get("/api/anomalies", authenticateToken, async (req, res) => {
  try {
    const rawTraffic = await redisClient.lRange("recent_traffic", 0, 199);
    const entries = rawTraffic.map((raw) => {
      try { return JSON.parse(raw); } catch { return null; }
    }).filter(Boolean);

    const buckets = {};
    entries.forEach((entry) => {
      const time = entry.timestamp ? entry.timestamp.substring(0, 16) : "unknown";
      if (!buckets[time]) buckets[time] = { time, count: 0, totalScore: 0, anomalous: 0 };
      buckets[time].count++;
      buckets[time].totalScore += entry.anomaly_score || 0;
      if (entry.severity && entry.severity !== "NORMAL") buckets[time].anomalous++;
    });

    const anomalies = Object.values(buckets)
      .map((b) => ({
        time: b.time,
        count: b.count,
        avgScore: b.count > 0 ? Math.round((b.totalScore / b.count) * 100) / 100 : 0,
        anomalous: b.anomalous,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({ anomalies });
  } catch (err) {
    logger.error({ err: err.message }, "/anomalies error");
    res.json({ anomalies: [] });
  }
});

app.get("/api/attackers", authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const rawAttackers = await redisClient.zRange("attacker_ips", 0, limit - 1, { REV: true, WITHSCORES: true });
    const attackers = [];
    if (Array.isArray(rawAttackers)) {
      for (const item of rawAttackers) {
        if (item && item.value) {
          attackers.push({ ip: item.value, threat_score: Math.round(item.score * 100) / 100 });
        }
      }
    }
    res.json({ attackers });
  } catch (err) {
    logger.error({ err: err.message }, "/attackers error");
    res.json({ attackers: [] });
  }
});

app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const stats = await redisClient.hGetAll("dashboard_stats");
    const activeAttackers = await redisClient.zCard("attacker_ips");
    const result = {
      total_events: parseInt(stats.total_events) || 0,
      total_alerts: parseInt(stats.total_alerts) || 0,
      high_threats: parseInt(stats.high_threats) || 0,
      active_attackers: activeAttackers || 0,
    };
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "/stats error");
    res.json({ total_events: 0, total_alerts: 0, high_threats: 0, active_attackers: 0 });
  }
});

// MITRE ATT&CK reference endpoint
app.get("/api/mitre", authenticateToken, (req, res) => {
  res.json({ mappings: MITRE_ATTACK });
});

// ──────────────────────── O-RAN / Telecom Endpoints ────────────────────────

// O1 Telemetry — RAN Performance Management Counters
app.get("/api/oran/telemetry", authenticateToken, async (req, res) => {
  try {
    const raw = await redisClient.get("o1_telemetry");
    const telemetry = raw ? JSON.parse(raw) : [];
    res.json({ telemetry, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ err: err.message }, "/oran/telemetry error");
    res.json({ telemetry: [], timestamp: new Date().toISOString() });
  }
});

// A1 Policy Audit — List current policies with risk scoring
app.get("/api/oran/policies", authenticateToken, async (req, res) => {
  try {
    const raw = await redisClient.get("a1_policies");
    let policies = raw ? JSON.parse(raw) : [];

    // Dynamic risk scoring based on current threat landscape
    const stats = await redisClient.hGetAll("dashboard_stats");
    const highThreats = parseInt(stats.high_threats) || 0;
    const telecomThreats = parseInt(stats.telecom_threats) || 0;

    policies = policies.map((p) => {
      let riskAdjust = 0;
      // Increase risk for energy-saving policies when telecom attacks detected
      if (p.policy_type.includes("Energy Saving") && telecomThreats > 5) {
        riskAdjust = 0.2;
      }
      // Increase risk for handover policies when handover attacks detected
      if (p.policy_type.includes("Handover") && highThreats > 10) {
        riskAdjust = 0.15;
      }
      return {
        ...p,
        risk_score: Math.min(1.0, Math.round((p.risk_score + riskAdjust) * 100) / 100),
        status: p.risk_score + riskAdjust > 0.5 ? "AUDIT_REQUIRED" : p.status,
      };
    });

    res.json({
      policies,
      meta: {
        total: policies.length,
        at_risk: policies.filter((p) => p.risk_score > 0.5).length,
        audit_required: policies.filter((p) => p.status === "AUDIT_REQUIRED").length,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, "/oran/policies error");
    res.json({ policies: [], meta: { total: 0, at_risk: 0, audit_required: 0 } });
  }
});

// A1 Policy Audit — Validate a specific policy against security rules
app.post("/api/oran/policies/audit", authenticateToken, async (req, res) => {
  try {
    const { policy_id } = req.body;
    const raw = await redisClient.get("a1_policies");
    const policies = raw ? JSON.parse(raw) : [];
    const policy = policies.find((p) => p.policy_id === policy_id);

    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    // Simulate RAG-based security audit
    const auditResult = {
      policy_id: policy.policy_id,
      policy_type: policy.policy_type,
      audit_timestamp: new Date().toISOString(),
      security_checks: [
        {
          rule: "O-RAN TS 803 §4.3 — Zero-Trust Authentication",
          status: policy.risk_score < 0.3 ? "PASS" : "WARN",
          detail: "Policy authentication scope validated",
        },
        {
          rule: "3GPP TS 33.501 §6.1 — Integrity Protection",
          status: "PASS",
          detail: "Integrity protection requirements met",
        },
        {
          rule: "O-RAN.WG11 §5.2 — rApp Security Boundary",
          status: policy.risk_score > 0.5 ? "FAIL" : "PASS",
          detail: policy.risk_score > 0.5
            ? "Policy may create attack surface outside security boundary"
            : "Policy within authorized security boundary",
        },
        {
          rule: "NIST SP 800-187 — Slice Isolation",
          status: policy.policy_type.includes("Security") || policy.risk_score < 0.4 ? "PASS" : "WARN",
          detail: "Network slice isolation compliance check",
        },
      ],
      overall_risk: policy.risk_score > 0.5 ? "HIGH" : policy.risk_score > 0.3 ? "MEDIUM" : "LOW",
      recommendation: policy.risk_score > 0.5
        ? "BLOCK — Policy creates unacceptable security exposure. Review with SOC team."
        : policy.risk_score > 0.3
          ? "REVIEW — Policy has moderate risk. Monitor after deployment."
          : "APPROVE — Policy meets all security requirements.",
    };

    res.json({ audit: auditResult });
  } catch (err) {
    logger.error({ err: err.message }, "/oran/policies/audit error");
    res.status(500).json({ error: "Audit failed" });
  }
});

// Network Slices Status
app.get("/api/oran/slices", authenticateToken, async (req, res) => {
  try {
    const raw = await redisClient.get("network_slices");
    const slices = raw ? JSON.parse(raw) : [];
    res.json({ slices });
  } catch (err) {
    logger.error({ err: err.message }, "/oran/slices error");
    res.json({ slices: [] });
  }
});

// Security Posture Score — aggregated risk assessment
app.get("/api/oran/posture", authenticateToken, async (req, res) => {
  try {
    const stats = await redisClient.hGetAll("dashboard_stats");
    const activeAttackers = await redisClient.zCard("attacker_ips");
    const totalEvents = parseInt(stats.total_events) || 1;
    const totalAlerts = parseInt(stats.total_alerts) || 0;
    const highThreats = parseInt(stats.high_threats) || 0;
    const telecomThreats = parseInt(stats.telecom_threats) || 0;

    // Calculate security posture score (0-100, higher = more secure)
    let postureScore = 100;
    postureScore -= Math.min(30, (totalAlerts / Math.max(totalEvents, 1)) * 300);
    postureScore -= Math.min(25, highThreats * 0.5);
    postureScore -= Math.min(20, telecomThreats * 1.5);
    postureScore -= Math.min(15, activeAttackers * 2);
    postureScore = Math.max(0, Math.round(postureScore * 100) / 100);

    // Get policy audit status
    const rawPolicies = await redisClient.get("a1_policies");
    const policies = rawPolicies ? JSON.parse(rawPolicies) : [];
    const policiesAtRisk = policies.filter((p) => p.risk_score > 0.5).length;

    // Compliance areas
    const compliance = [
      { area: "Zero-Trust Authentication", score: highThreats > 20 ? 60 : 92, standard: "O-RAN TS 803" },
      { area: "Slice Isolation", score: telecomThreats > 5 ? 70 : 95, standard: "3GPP TS 33.813" },
      { area: "A1 Policy Security", score: policiesAtRisk > 0 ? 65 : 98, standard: "O-RAN WG2" },
      { area: "Encryption (PDCP)", score: 97, standard: "3GPP TS 33.501" },
      { area: "Mutual Auth (gNB)", score: highThreats > 10 ? 75 : 94, standard: "3GPP TS 33.501" },
      { area: "Signaling Protection", score: telecomThreats > 3 ? 72 : 90, standard: "O-RAN WG11" },
    ];

    res.json({
      posture_score: postureScore,
      risk_level: postureScore >= 80 ? "LOW" : postureScore >= 50 ? "MEDIUM" : "HIGH",
      compliance,
      summary: {
        total_events: totalEvents,
        total_alerts: totalAlerts,
        high_threats: highThreats,
        telecom_threats: telecomThreats,
        active_attackers: activeAttackers,
        policies_at_risk: policiesAtRisk,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, "/oran/posture error");
    res.json({ posture_score: 0, risk_level: "UNKNOWN", compliance: [], summary: {} });
  }
});

// Network topology data
app.get("/api/topology", authenticateToken, async (req, res) => {
  try {
    const rawTraffic = await redisClient.lRange("recent_traffic", 0, 99);
    const entries = rawTraffic.map((raw) => {
      try { return JSON.parse(raw); } catch { return null; }
    }).filter(Boolean);

    // Build node and edge maps for topology
    const nodeMap = {};
    const edgeMap = {};

    entries.forEach((e) => {
      const srcIp = e.src_ip || "unknown";
      if (!nodeMap[srcIp]) {
        nodeMap[srcIp] = {
          id: srcIp,
          type: srcIp.startsWith("192.168.") || srcIp.startsWith("10.0.") ? "internal" : "external",
          threatLevel: 0,
          connections: 0,
        };
      }
      nodeMap[srcIp].connections++;
      nodeMap[srcIp].threatLevel = Math.max(nodeMap[srcIp].threatLevel, e.threat_score || 0);

      const edgeKey = `${srcIp}`;
      if (!edgeMap[edgeKey]) {
        edgeMap[edgeKey] = { source: srcIp, count: 0, maxSeverity: "NORMAL" };
      }
      edgeMap[edgeKey].count++;
      if (e.severity === "HIGH") edgeMap[edgeKey].maxSeverity = "HIGH";
      else if (e.severity === "MEDIUM" && edgeMap[edgeKey].maxSeverity !== "HIGH") edgeMap[edgeKey].maxSeverity = "MEDIUM";
    });

    res.json({
      nodes: Object.values(nodeMap).slice(0, 30),
      edges: Object.values(edgeMap).slice(0, 50),
    });
  } catch (err) {
    logger.error({ err: err.message }, "/topology error");
    res.json({ nodes: [], edges: [] });
  }
});

// Root fallback
app.get("/", (req, res) => {
  res.json({
    message: "SentinelMesh API Gateway v3.0 is running.",
    dashboard_url: FRONTEND_URL,
    status: "ok",
    docs: "Visit /api/health for system status"
  });
});

// Health check (no auth)
app.get("/api/health", async (req, res) => {
  let redisOk = false;
  try { await redisClient.ping(); redisOk = true; } catch {}
  res.json({
    status: "ok",
    version: "3.0.0",
    redis: redisOk ? "connected" : "disconnected",
    websocket: io.engine.clientsCount,
    uptime: Math.round(process.uptime()),
    oran_enabled: true,
  });
});

// Prometheus-compatible metrics
app.get("/api/metrics", async (req, res) => {
  let redisOk = false;
  try { await redisClient.ping(); redisOk = true; } catch {}
  const stats = await redisClient.hGetAll("dashboard_stats").catch(() => ({}));
  const metrics = [
    `# HELP sentinelmesh_events_total Total events processed`,
    `# TYPE sentinelmesh_events_total counter`,
    `sentinelmesh_events_total ${parseInt(stats.total_events) || 0}`,
    `# HELP sentinelmesh_alerts_total Total alerts generated`,
    `# TYPE sentinelmesh_alerts_total counter`,
    `sentinelmesh_alerts_total ${parseInt(stats.total_alerts) || 0}`,
    `# HELP sentinelmesh_high_threats_total High severity threats`,
    `# TYPE sentinelmesh_high_threats_total counter`,
    `sentinelmesh_high_threats_total ${parseInt(stats.high_threats) || 0}`,
    `# HELP sentinelmesh_websocket_connections Active WebSocket connections`,
    `# TYPE sentinelmesh_websocket_connections gauge`,
    `sentinelmesh_websocket_connections ${io.engine.clientsCount}`,
    `# HELP sentinelmesh_redis_connected Redis connection status`,
    `# TYPE sentinelmesh_redis_connected gauge`,
    `sentinelmesh_redis_connected ${redisOk ? 1 : 0}`,
    `# HELP sentinelmesh_uptime_seconds Server uptime`,
    `# TYPE sentinelmesh_uptime_seconds gauge`,
    `sentinelmesh_uptime_seconds ${Math.round(process.uptime())}`,
  ].join("\n");
  res.set("Content-Type", "text/plain");
  res.send(metrics);
});

// ──────────────────────── Graceful Shutdown ────────────────────────
function shutdown(signal) {
  logger.info({ signal }, "Graceful shutdown initiated");
  server.close(() => {
    redisClient?.quit();
    redisSub?.quit();
    logger.info("Server closed");
    process.exit(0);
  });
  // Force shutdown after 10s
  setTimeout(() => process.exit(1), 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ──────────────────────── Start Server ────────────────────────
async function start() {
  await connectRedis();

  // Broadcast pipeline: poll Redis for new events and push via Socket.IO
  setInterval(async () => {
    try {
      const stats = await redisClient.hGetAll("dashboard_stats");
      const activeAttackers = await redisClient.zCard("attacker_ips");
      io.emit("stats:update", {
        total_events: parseInt(stats.total_events) || 0,
        total_alerts: parseInt(stats.total_alerts) || 0,
        high_threats: parseInt(stats.high_threats) || 0,
        active_attackers: activeAttackers || 0,
      });
    } catch {}
  }, 3000);

  // Push latest alerts via Socket.IO
  let lastAlertCount = 0;
  setInterval(async () => {
    try {
      const total = await redisClient.zCard("alerts_by_score");
      if (total > lastAlertCount) {
        const newAlerts = await redisClient.zRange("alerts_by_score", 0, Math.min(total - lastAlertCount - 1, 4), { REV: true });
        newAlerts.forEach((raw) => {
          try {
            const alert = JSON.parse(raw);
            const mitre = MITRE_ATTACK[alert.event_type] || MITRE_ATTACK.normal;
            io.emit("threat:new", { ...alert, mitre });
          } catch {}
        });
        lastAlertCount = total;
      }
    } catch {}
  }, 2000);

  server.listen(PORT, () => {
    logger.info("═══════════════════════════════════════════════════");
    logger.info(`  SentinelMesh API Gateway v3.0.0 — Port ${PORT}`);
    logger.info(`  WebSocket: ws://localhost:${PORT}`);
    logger.info(`  OAuth: ${GITHUB_CLIENT_ID ? "CONFIGURED" : "NOT SET (demo only)"}`);
    logger.info(`  O-RAN: Telemetry + A1 Policy Audit enabled`);
    logger.info(`  Frontend: ${FRONTEND_URL}`);
    logger.info(`  Metrics: http://localhost:${PORT}/api/metrics`);
    logger.info("═══════════════════════════════════════════════════");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});

module.exports = { app, server, io };
