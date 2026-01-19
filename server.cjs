
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// n8n Webhook URLs
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
 * READ ENDPOINTS (Frontend reads what n8n inserted)
 */
app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, ip_address, hostname, overall_score, summary, device_firmware, created_at FROM audit_reports ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports from DB" });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM firewall_logs ORDER BY receive_time DESC LIMIT 500");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs from DB" });
  }
});

/**
 * PROXY ENDPOINTS (Triggers n8n, which handles the logic and DB insertion)
 */

// 1. Audit Proxy: Frontend -> Backend -> n8n -> (AI -> DB) -> Return to Frontend
app.post("/api/audit", async (req, res) => {
  try {
    const response = await fetch(N8N_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    // n8n returns the final report object which we forward to frontend
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "n8n Audit failed: " + err.message });
  }
});

// 2. Logs Proxy: Frontend -> Backend -> n8n -> (Firewall Logs -> DB) -> Return to Frontend
app.post("/api/logs", async (req, res) => {
  try {
    const response = await fetch(N8N_LOGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.body, action: 'get_logs' })
    });
    const data = await response.json();
    // n8n returns logs which we forward to frontend (Frontend will also refresh from DB)
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "n8n Logs fetch failed: " + err.message });
  }
});

// 3. Config Proxy: Frontend -> Backend -> n8n -> (Get XML) -> Return to Frontend
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
    res.status(500).json({ error: "n8n Config fetch failed: " + err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Proxy active on port ${port}. Orchestration handled by n8n @ 10.1.240.2`);
});
