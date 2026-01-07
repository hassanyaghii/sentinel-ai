
export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export interface SecurityFinding {
  id: string;
  title: string;
  category: string;
  risk: RiskLevel;
  description: string;
  recommendation: string;
}

export interface FirewallReport {
  overallScore: number;
  summary: string;
  findings: SecurityFinding[];
  deviceInfo: {
    hostname: string;
    firmware: string;
    uptime: string;
  };
}

export interface AuditConfig {
  ipAddress: string;
  apiKey: string;
  vendor: 'fortinet' | 'cisco' | 'paloalto' | 'generic';
  webhookUrl: string;
}

export interface ParsedRule {
  id: number;
  name?: string;
  action: 'permit' | 'deny' | 'allow' | 'accept' | 'drop' | 'reject' | 'unknown';
  protocol: string;
  source: string;
  destination: string;
  port: string;
  raw: string;
}
