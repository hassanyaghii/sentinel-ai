
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

// ✅ Use nginx proxy for n8n (recommended)
const N8N_AUDIT_URL = "https://10.1.244.70/n8n/webhook/analyze-firewall";
const N8N_CONFIG_URL = "https://10.1.244.70/n8n/webhook/getconfig";
const N8N_LOGS_URL = "https://10.1.244.70/n8n/webhook/logs";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "sentinel_user",
  password: process.env.DB_PASS || "", // ✅ safer
  database: process.env.DB_NAME || "sentinel_audit",
  waitForConnections: true,
  connectionLimit: 10,
};

let pool = null;

async function initDB() {
  try {
    pool = await mysql.createPool(dbConfig);
    await pool.query("SELECT 1");
    console.log("✅ MySQL Connected to:", dbConfig.database);
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
    pool = null;
  }
}
initDB();

function unwrapN8N(rawData) {
  let data = Array.isArray(rawData) ? rawData[0] : rawData;
  return data?.body ?? data?.data ?? data?.output ?? data;
}

/**
 * DATABASE READ ENDPOINTS
 */
app.get("/api/reports", async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "DB not connected" });

    const [rows] = await pool.execute(
      `SELECT id, ip_address, hostname, overall_score, summary, device_firmware, created_at
       FROM audit_reports
       ORDER BY created_at DESC`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.get("/api/reports/:id", async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: "DB not connected" });

    const [report] = await pool.execute(
      "SELECT * FROM audit_reports WHERE id = ?",
      [req.params.id]
    );
    if (report.length === 0) return res.status(404).json({ error: "Report not found" });

    const [findings] = await pool.execute(
      "SELECT * FROM security_findings WHERE report_id = ?",
      [req.params.id]
    );

    res.json({ ...report[0], findings });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch report details" });
  }
});

/**
 * ACTION PROXY ENDPOINTS
 */
app.post("/api/audit", async (req, res) => {
  try {
    const { ipAddress, apiKey, vendor } = req.body;

    const response = await fetch(N8N_AUDIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress, apiKey, vendor }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`n8n audit error ${response.status}: ${text}`);
    }

    const rawData = await response.json();
    const report = unwrapN8N(rawData);

    // Save to MySQL
    if (pool && report) {
      const overallScore = report.overallScore ?? report.overall_score ?? null;
      const hostname =
        report.deviceInfo?.hostname ?? report.device_info?.hostname ?? "Unknown";
      const firmware =
        report.deviceInfo?.firmware ?? report.device_info?.firmware ?? "Unknown";
      const summary = report.summary ?? "Audit complete";

      if (overallScore !== null) {
        const [resObj] = await pool.execute(
          `INSERT INTO audit_reports (ip_address, hostname, overall_score, summary, device_firmware)
           VALUES (?, ?, ?, ?, ?)`,
          [ipAddress, hostname, overallScore, summary, firmware]
        );

        const reportId = resObj.insertId;
        const findings = report.findings ?? [];

        for (const f of findings) {
          await pool.execute(
            `INSERT INTO security_findings (report_id, risk_level, category, title, description, recommendation)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              reportId,
              f.risk ?? "Low",
              f.category ?? "General",
              f.title ?? "Finding",
              f.description ?? "",
              f.recommendation ?? "",
            ]
          );
        }

        console.log(`✅ Audit saved to DB. ID=${reportId}`);
      }
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const { ipAddress, apiKey, vendor } = req.body;

    const response = await fetch(N8N_CONFIG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress, apiKey, vendor }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`n8n config error ${response.status}: ${text}`);
    }

    const rawData = await response.json();
    const result = unwrapN8N(rawData);

    // Save full XML snapshot
    if (pool && result?.firewallConfig) {
      await pool.execute(
        "INSERT INTO config_snapshots (ip_address, hostname, raw_xml) VALUES (?, ?, ?)",
        [ipAddress, result.hostname ?? "Unknown", result.firewallConfig]
      );
      console.log("✅ Config snapshot saved");
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logs", async (req, res) => {
  try {
    const response = await fetch(N8N_LOGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`n8n logs error ${response.status}: ${text}`);
    }

    const rawData = await response.json();
    const result = unwrapN8N(rawData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Sentinel Engine running on port ${port}`);
});
