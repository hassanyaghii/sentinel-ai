
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// Your n8n Orchestrator URLs (10.1.240.2)
const N8N_AUDIT_URL = "https://10.1.240.2/webhook/analyze-firewall";
const N8N_CONFIG_URL = "https://10.1.240.2/webhook/getconfig";
const N8N_LOGS_URL = "https://10.1.240.2/webhook/logs";

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database configuration for READ access
const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "sentinel_user",
  password: process.env.DB_PASS || "sentinel_pass",
  database: process.env.DB_NAME || "sentinel_audit",
  waitForConnections: true,
  connectionLimit: 10
};

let pool = null;
async function initDB() {
  try {
    pool = await mysql.createPool(dbConfig);
    console.log("✅ MySQL Connected for Reading:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
  }
}
initDB();

/**
 * 1. AI AUDIT PROXY
 */
app.post("/api/audit", async (req, res) => {
  console.log("🚀 Proxying Audit request to n8n...");
  try {
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Audit Proxy Error:", err);
    res.status(500).json({ error: "Failed to reach n8n Audit Webhook" });
  }
});

/**
 * 2. CONFIG FETCH PROXY
 */
app.post("/api/config", async (req, res) => {
  console.log("🚀 Proxying Config Fetch to n8n...");
  try {
    const response = await fetch(N8N_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Config Proxy Error:", err);
    res.status(500).json({ error: "Failed to reach n8n Config Webhook" });
  }
});

/**
 * 3. LOG SYNC PROXY
 */
app.post("/api/logs", async (req, res) => {
  console.log("🚀 Proxying Log Sync to n8n...");
  try {
    const response = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.body, action: 'get_logs' })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Log Proxy Error:", err);
    res.status(500).json({ error: "Failed to reach n8n Logs Webhook" });
  }
});

/**
 * READ-ONLY DB ACCESS
 */
app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM audit_reports ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error: " + err.message });
  }
});

app.get("/api/reports/:id", async (req, res) => {
  try {
    const [reports] = await pool.execute("SELECT * FROM audit_reports WHERE id = ?", [req.params.id]);
    if (reports.length === 0) return res.status(404).json({ error: "Not found" });
    
    const [findings] = await pool.execute("SELECT * FROM security_findings WHERE report_id = ?", [req.params.id]);
    const result = reports[0];
    result.findings = findings;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error: " + err.message });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM firewall_logs ORDER BY receive_time DESC LIMIT 200");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error: " + err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`
  🛡️  Sentinel Backend Proxy Started
  ---------------------------------
  Port: ${port}
  n8n Target: 10.1.240.2
  MySQL Target: ${dbConfig.host}
  ---------------------------------
  `);
});
