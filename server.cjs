
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

// Global setting to allow self-signed certificates for the internal network
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database configuration
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
    console.log("✅ MySQL Connected for Telemetry Persistence:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
  }
}
initDB();

/**
 * 1. AI AUDIT PROXY
 */
app.post("/api/audit", async (req, res) => {
  try {
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reach n8n Audit Webhook" });
  }
});

/**
 * 2. CONFIG FETCH PROXY
 */
app.post("/api/config", async (req, res) => {
  try {
    const response = await fetch(N8N_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reach n8n Config Webhook" });
  }
});

/**
 * 3. LOG SYNC PROXY (New)
 */
app.post("/api/logs", async (req, res) => {
  console.log("🚀 Proxying Log Sync request to n8n...");
  try {
    const response = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `n8n Error: ${errText}` });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ error: "Backend failed to communicate with n8n log agent" });
  }
});

/**
 * 4. DB READ ACCESS
 */
app.get("/api/config-snapshots", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM config_snapshots ORDER BY created_at DESC LIMIT 100");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error (config_snapshots): " + err.message });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM firewall_logs ORDER BY receive_time DESC LIMIT 500");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error (firewall_logs): " + err.message });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM audit_reports ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error (audit_reports): " + err.message });
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

app.listen(port, "0.0.0.0", () => {
  console.log(`🛡️ Sentinel Proxy Server active on port ${port}`);
});
