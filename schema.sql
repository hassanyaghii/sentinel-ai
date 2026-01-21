
CREATE DATABASE IF NOT EXISTS sentinel_audit;
USE sentinel_audit;

-- Store AI Audit Reports
CREATE TABLE IF NOT EXISTS audit_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    overall_score INT,
    summary TEXT,
    device_firmware VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store individual AI security findings
CREATE TABLE IF NOT EXISTS security_findings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT,
    risk_level VARCHAR(20),
    category VARCHAR(100),
    title VARCHAR(255),
    description TEXT,
    recommendation TEXT,
    FOREIGN KEY (report_id) REFERENCES audit_reports(id) ON DELETE CASCADE
);

-- Store Firewall Configuration Logs (Telemetry)
CREATE TABLE IF NOT EXISTS firewall_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45),
    receive_time DATETIME,
    admin_user VARCHAR(100),
    client_type VARCHAR(50),
    command VARCHAR(50),
    result VARCHAR(50),
    config_path TEXT,
    before_change TEXT,
    after_change TEXT,
    sequence_no VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
