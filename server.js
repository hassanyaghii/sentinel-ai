
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// Configuration for n8n webhooks
const N8N_AUDIT_URL = "https://10.1.240.2/webhook/analyze-firewall";
const N8N_CONFIG_URL = "https://10.1.240.2/webhook/getconfig";
const N8N_LOGS_URL = "https://10.1.240.2/webhook/logs";

app.use(cors());
app.use(express.json());

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
    console.log("✅ MySQL Connected:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
}
initDB();

/**
 * AI Audit Proxy + Database Logger
 */
app.post("/api/audit", async (req, res) => {
  const { ipAddress, apiKey, vendor } = req.body;

  try {
    console.log(`Forwarding audit request for ${ipAddress} to n8n...`);
    
    // 1. Call n8n Agent
    const n8nResponse = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, apiKey, vendor })
    });

    if (!n8nResponse.ok) {
      throw new Error(`n8n responded with ${n8nResponse.status}`);
    }

    const rawData = await n8nResponse.json();
    
    // Unwrap n8n standard output
    let report = Array.isArray(rawData) ? rawData[0] : rawData;
    report = report?.body ?? report?.data ?? report?.output ?? report;

    // 2. Log result to MySQL
    if (pool && report) {
      try {
        const score = report.overallScore ?? report.overall_score ?? 0;
        const summary = report.summary ?? "Audit complete";
        const hostname = report.deviceInfo?.hostname ?? report.device_info?.hostname ?? "Unknown";
        const firmware = report.deviceInfo?.firmware ?? report.device_info?.firmware ?? "N/A";

        const [result] = await pool.execute(
          `INSERT INTO audit_reports (ip_address, hostname, overall_score, summary, device_firmware)
           VALUES (?, ?, ?, ?, ?)`,
          [ipAddress, hostname, score, summary, firmware]
        );

        const findings = report.findings ?? [];
        for (const f of findings) {
          await pool.execute(
            `INSERT INTO security_findings (report_id, risk_level, category, title, description, recommendation)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [result.insertId, f.risk || 'Low', f.category || 'General', f.title || 'Finding', f.description || '', f.recommendation || '']
          );
        }
        console.log(`✅ Saved report ID ${result.insertId} to MySQL`);
      } catch (dbErr) {
        console.error("⚠️ MySQL Logging failed, but returning data to user:", dbErr.message);
      }
    }

    return res.json(report);
  } catch (err) {
    console.error("❌ Audit Route Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Proxy for Config Extraction
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
    res.status(500).json({ error: err.message });
  }
});

/**
 * Proxy for Logs/Telemetry
 */
app.post("/api/logs", async (req, res) => {
  try {
    const response = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Sentinel API running on port ${port}`);
});
