# MySQL Database Setup for Sentinel AI

This guide explains how to persist firewall audit logs and configurations in a MySQL database.

## 1. Docker Compose Configuration
Add the following service to your `docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: sentinel_db
    environment:
      - MYSQL_ROOT_PASSWORD=sentinel_root_pass
      - MYSQL_DATABASE=sentinel_audit
      - MYSQL_USER=sentinel_user
      - MYSQL_PASSWORD=sentinel_pass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - sentinel-net

volumes:
  mysql_data:
```

## 2. SQL Schema
Run the following SQL to initialize the tables:

```sql
CREATE DATABASE IF NOT EXISTS sentinel_audit;
USE sentinel_audit;

CREATE TABLE IF NOT EXISTS audit_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    overall_score INT,
    summary TEXT,
    device_firmware VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_findings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT,
    risk_level ENUM('Low', 'Medium', 'High', 'Critical'),
    category VARCHAR(100),
    title VARCHAR(255),
    description TEXT,
    recommendation TEXT,
    FOREIGN KEY (report_id) REFERENCES audit_reports(id) ON DELETE CASCADE
);
```

## 3. n8n Integration
In your n8n workflow:
1. Add a **MySQL Node** after the Gemini AI analysis.
2. Select the **Insert** action.
3. Map the `$json.overallScore` and `$json.summary` to the `audit_reports` table.
4. Use a **Split in Batches** node to loop through `$json.findings` and insert them into the `security_findings` table using the `LAST_INSERT_ID()` from the first query.
