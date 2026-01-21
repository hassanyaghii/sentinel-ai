
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const https = require("https");

const app = express();
const port = process.env.PORT || 3001;

// Your n8n Orchestrator URLs (n8n.bmbgroup.com)
const N8N_AUDIT_URL = "https://n8n.bmbgroup.com/webhook/analyze-firewall";
const N8N_CONFIG_URL = "https://n8n.bmbgroup.com/webhook/getconfig";
const N8N_LOGS_URL = "https://n8n.bmbgroup.com/webhook/logs";

// Create an agent that allows self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

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
  console.log("🚀 Proxying LIVE Audit request to n8n (bypassing SSL check)...");
  try {
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      dispatcher: agent // In Node 18+, fetch uses undici. We can also use process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' as a fallback.
    });
    
    // Fallback if the above doesn't work in specific node environments:
    // Some node versions require setting the env var globally for global fetch
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    if (!response.ok) throw new Error(`n8n audit error: ${response.statusText}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Audit Proxy Error:", err);
    res.status(500).json({ error: "Failed to reach n8n Audit Webhook: " + err.message });
  }
});

/**
 * 2. CONFIG FETCH PROXY
 */
app.post("/api/config", async (req, res) => {
  console.log("🚀 Proxying Config Fetch to n8n...");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const response = await fetch(N8N_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    if (!response.ok) throw new Error(`n8n config error: ${response.statusText}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Config Proxy Error:", err);
    res.status(500).json({ error: "Failed to reach n8n Config Webhook" });
  }
});

/**
 * 3. LOG SYNC & DATABASE PERSISTENCE
 */
app.post("/api/logs", async (req, res) => {
  console.log("🚀 Triggering n8n Telemetry Sync & Database Persistence...");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const n8nResponse = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ipAddress: req.body.ipAddress, 
        apiKey: req.body.apiKey,
        action: 'sync_telemetry' 
      })
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("❌ n8n Webhook Error:", errorText);
      throw new Error(`n8n log fetch failed: ${n8nResponse.statusText}`);
    }
    
    const logs = await n8nResponse.json();
    const logArray = Array.isArray(logs) ? logs : (logs.data && Array.isArray(logs.data)) ? logs.data : [logs];

    if (logArray.length > 0 && pool) {
      console.log(`📥 Received ${logArray.length} telemetry records. Persisting...`);
      
      const insertQuery = `
        INSERT INTO firewall_logs 
        (ip_address, receive_time, admin_user, client_type, command, result, config_path, before_change, after_change, sequence_no)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
          receive_time=VALUES(receive_time),
          admin_user=VALUES(admin_user),
          result=VALUES(result)
      `;

      const values = logArray.map(log => [
        req.body.ipAddress || log.ip_address || 'unknown',
        log.receive_time || new Date().toISOString().slice(0, 19).replace('T', ' '),
        log.admin_user || 'unknown',
        log.client_type || 'web',
        log.command || 'edit',
        log.result || 'succeeded',
        log.config_path || log.path || '',
        log.before_change || '',
        log.after_change || '',
        log.sequence_no || log.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      ]);

      await pool.query(insertQuery, [values]);
      console.log("✅ Telemetry logs synchronized and persisted to MySQL.");
    }

    res.json({ success: true, count: logArray.length, message: "Sync complete" });
  } catch (err) {
    console.error("Log Sync Error:", err);
    res.status(500).json({ error: "Failed to sync telemetry: " + err.message });
  }
});

/**
 * READ ACCESS - Pull from MySQL
 */
app.get("/api/logs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM firewall_logs ORDER BY receive_time DESC LIMIT 500");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB Read Error: " + err.message });
  }
});

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

app.listen(port, "0.0.0.0", () => {
  console.log(`
  🛡️ Sentinel Proxy Server
  ------------------------
  Port: ${port}
  n8n: https://n8n.bmbgroup.com (Insecure SSL allowed)
  MySQL: ${dbConfig.database}
  ------------------------
  `);
});
