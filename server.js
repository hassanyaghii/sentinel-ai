
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

/**
 * ✅ CORS
 * Set allowed origins from env (can support multiple origins)
 * Example: ALLOWED_ORIGINS=https://10.1.244.70,http://10.1.244.70
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server requests (curl/postman) where origin is undefined
      if (!origin) return callback(null, true);

      if (allowedOrigins.length === 0) return callback(null, true); // allow all if not set

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error("CORS blocked: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/**
 * ✅ MySQL config from .env
 */
const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "sentinel_user",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "sentinel_audit",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;

/**
 * ✅ Init DB Connection
 */
async function initDB() {
  try {
    pool = await mysql.createPool(dbConfig);
    await pool.query("SELECT 1");
    console.log("✅ MySQL Connected:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    pool = null;
  }
}
initDB();

/**
 * ✅ Middleware: ensure DB ready
 */
app.use((req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      error: "Database not connected",
      hint: "Check DB service + .env config",
    });
  }
  next();
});

/**
 * ✅ Health check endpoint
 */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "down" });
  }
});

/**
 * ✅ Audit endpoint
 * Later: replace mockData with actual Palo Alto API calls.
 */
app.post("/api/audit", async (req, res) => {
  const { ipAddress, apiKey } = req.body;

  if (!ipAddress) {
    return res.status(400).json({ error: "ipAddress is required" });
  }

  try {
    // 🔥 MOCK DATA (replace later with real scan)
    const mockData = {
      overallScore: 82,
      summary:
        "Analysis performed directly on server. Data written to MySQL securely.",
      deviceInfo: {
        hostname: "FW-CORE-70",
        firmware: "v11.0.1",
        uptime: "12 days",
      },
      findings: [
        {
          title: "SSH Version 1 Enabled",
          risk: "High",
          category: "Access",
          description: "Insecure management protocol.",
          recommendation: "Force SSHv2 only.",
        },
      ],
    };

    // Insert report
    const [result] = await pool.execute(
      `INSERT INTO audit_reports
       (ip_address, hostname, overall_score, summary, device_firmware)
       VALUES (?, ?, ?, ?, ?)`,
      [
        ipAddress,
        mockData.deviceInfo.hostname,
        mockData.overallScore,
        mockData.summary,
        mockData.deviceInfo.firmware,
      ]
    );

    // Insert findings
    for (const f of mockData.findings) {
      await pool.execute(
        `INSERT INTO security_findings
         (report_id, risk_level, category, title, description, recommendation)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          f.risk,
          f.category,
          f.title,
          f.description,
          f.recommendation,
        ]
      );
    }

    return res.json(mockData);
  } catch (err) {
    console.error("❌ /api/audit error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ Logs endpoint (mock)
 */
app.post("/api/logs", async (req, res) => {
  const logs = [
    {
      receive_time: new Date().toISOString(),
      admin: "admin",
      cmd: "edit",
      result: "Success",
      path: "security rules trust-to-untrust",
      after_change_preview: "modified",
    },
  ];

  res.json({ response: { result: { log: { logs: { entry: logs } } } } });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Sentinel API running on port ${port}`);
});
