
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
app.use(express.json({ limit: '10mb' })); // Increase limit for large XML configs

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

app.get("/api/reports/:id", async (req, res) => {
  try {
    const [report] = await pool.execute("SELECT * FROM audit_reports WHERE id = ?", [req.params.id]);
    const [findings] = await pool.execute("SELECT * FROM security_findings WHERE report_id = ?", [req.params.id]);
    if (report.length === 0) return res.status(404).json({ error: "Report not found" });
    res.json({ ...report[0], findings });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch report details" });
  }
});

/**
 * ACTION PROXY ENDPOINTS (Triggers n8n + Saves to DB)
 */
app.post("/api/audit", async (req, res) => {
  try {
    const { ipAddress, apiKey, vendor } = req.body;
    
    // 1. Trigger n8n Audit
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, apiKey, vendor })
    });
    
    const rawData = await response.json();
    let report = Array.isArray(rawData) ? rawData[0] : rawData;
    
    // 2. Save result to MySQL if it matches expected format
    if (pool && report && (report.overallScore !== undefined)) {
      try {
        const [resObj] = await pool.execute(
          `INSERT INTO audit_reports (ip_address, hostname, overall_score, summary, device_firmware) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            ipAddress, 
            report.deviceInfo?.hostname || 'vsys1', 
            report.overallScore, 
            report.summary, 
            report.deviceInfo?.firmware || 'Unknown'
          ]
        );

        const reportId = resObj.insertId;
        const findings = report.findings || [];
        
        for (const f of findings) {
          await pool.execute(
            `INSERT INTO security_findings (report_id, risk_level, category, title, description, recommendation) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [reportId, f.risk, f.category, f.title, f.description, f.recommendation]
          );
        }
        console.log(`✅ Audit result saved. ID: ${reportId}`);
      } catch (dbErr) {
        console.error("❌ DB Save Error:", dbErr.message);
      }
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const { ipAddress, apiKey } = req.body;
    const response = await fetch(N8N_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, apiKey })
    });
    
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;

    // Optional: Save configuration snapshot to DB
    if (pool && result.firewallConfig) {
      try {
        await pool.execute(
          "INSERT INTO config_snapshots (ip_address, hostname, raw_xml) VALUES (?, ?, ?)",
          [ipAddress, result.hostname || 'vsys1', result.firewallConfig]
        );
      } catch (dbErr) {
        console.error("Config log error:", dbErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Sentinel Engine running on port ${port}`);
});
