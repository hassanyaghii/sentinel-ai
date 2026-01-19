
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// Direct n8n URLs
const N8N_AUDIT_URL = "https://10.1.240.2/webhook/analyze-firewall";
const N8N_CONFIG_URL = "https://10.1.240.2/webhook/getconfig";
const N8N_LOGS_URL = "https://10.1.240.2/webhook/logs";

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    console.log("✅ MySQL Connected to:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
  }
}
initDB();

/**
 * DATABASE READ ENDPOINTS
 */
app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, ip_address, hostname, overall_score, summary, device_firmware, created_at FROM audit_reports ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Get stored telemetry logs
app.get("/api/logs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM firewall_logs ORDER BY receive_time DESC LIMIT 500");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs from DB" });
  }
});

/**
 * ACTION PROXY ENDPOINTS
 */
app.post("/api/logs", async (req, res) => {
  try {
    const { ipAddress, apiKey } = req.body;
    const response = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fw_ip: ipAddress, api_key: apiKey, action: 'get_logs' })
    });
    
    const rawData = await response.json();
    const data = rawData.response?.result?.log?.logs?.entry || rawData.response?.result?.log?.entry || rawData.logs || [];
    const entries = Array.isArray(data) ? data : [data];

    // Persist logs to DB
    if (pool && entries.length > 0) {
      for (const entry of entries) {
        try {
          // Check if sequence already exists to prevent duplicates
          const [exists] = await pool.execute("SELECT id FROM firewall_logs WHERE sequence_no = ?", [entry.seqno || '']);
          if (exists.length === 0) {
            await pool.execute(
              `INSERT INTO firewall_logs 
               (ip_address, receive_time, admin_user, client_type, command, result, config_path, before_change, after_change, sequence_no) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                ipAddress,
                entry.receive_time ? entry.receive_time.replace(/\//g, '-') : null,
                entry.admin || 'system',
                entry.client || 'unknown',
                entry.cmd || 'unknown',
                entry.result || 'unknown',
                entry.path || '',
                entry['before-change-preview'] || '',
                entry['after-change-preview'] || entry.after_change_preview || '',
                entry.seqno || ''
              ]
            );
          }
        } catch (e) { console.error("Log save error:", e.message); }
      }
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/audit", async (req, res) => {
  try {
    const { ipAddress, apiKey, vendor } = req.body;
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, apiKey, vendor })
    });
    const rawData = await response.json();
    let report = Array.isArray(rawData) ? rawData[0] : rawData;
    
    if (pool && report && (report.overallScore !== undefined)) {
      const [resObj] = await pool.execute(
        `INSERT INTO audit_reports (ip_address, hostname, overall_score, summary, device_firmware) VALUES (?, ?, ?, ?, ?)`,
        [ipAddress, report.deviceInfo?.hostname || 'vsys1', report.overallScore, report.summary, report.deviceInfo?.firmware || 'Unknown']
      );
      const reportId = resObj.insertId;
      for (const f of (report.findings || [])) {
        await pool.execute(
          `INSERT INTO security_findings (report_id, risk_level, category, title, description, recommendation) VALUES (?, ?, ?, ?, ?, ?)`,
          [reportId, f.risk, f.category, f.title, f.description, f.recommendation]
        );
      }
    }
    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Sentinel Engine running on port ${port}`);
});
