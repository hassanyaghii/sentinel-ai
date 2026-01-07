
import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Info,
  Lock,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Activity
} from 'lucide-react';
import { AuditConfig, FirewallReport, RiskLevel } from './types';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';

const App: React.FC = () => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<FirewallReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuditConfig>({
    ipAddress: '',
    apiKey: '',
    vendor: 'fortinet',
    webhookUrl: ''
  });

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    setConfig(auditConfig);

    // If using the demo/example URL, immediately use mock data
    if (auditConfig.webhookUrl.includes('example.com') || auditConfig.webhookUrl.includes('test-audit')) {
      setTimeout(() => {
        setReport(auditConfig.vendor === 'paloalto' ? MOCK_REPORT_PA : MOCK_REPORT_FORTINET);
        setIsAuditing(false);
      }, 1500);
      return;
    }

    try {
      if (!auditConfig.webhookUrl) {
        throw new Error("n8n Webhook URL is required. Please check your configuration.");
      }

      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error("Audit fetch error:", err);
      
      let errorMessage = err.message || "An unexpected error occurred.";
      
      if (err.message === "Failed to fetch") {
        errorMessage = "Connection Failed. This is usually due to CORS restrictions on your n8n instance or an unreachable Webhook URL.";
      }
      
      setError(errorMessage);
    } finally {
      setIsAuditing(false);
    }
  };

  const loadDemoAudit = () => {
    setIsAuditing(true);
    setError(null);
    setTimeout(() => {
      setReport(config.vendor === 'paloalto' ? MOCK_REPORT_PA : MOCK_REPORT_FORTINET);
      setIsAuditing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-400">AI</span></span>
            </div>
            <div className="hidden md:flex space-x-2">
              <span className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white shadow-md">
                Audit Dashboard
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar: Configuration */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Terminal className="w-5 h-5" />
                    <h2 className="text-lg font-bold">Connection</h2>
                  </div>
                </div>
                <SetupForm 
                  onSubmit={handleRunAudit} 
                  isLoading={isAuditing} 
                  initialValues={config} 
                  onConfigChange={setConfig}
                />
                
                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-start space-x-3 text-blue-700">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">How it works</p>
                      <p className="opacity-90 text-xs">This tool sends credentials to your n8n AI agent, which fetches and analyzes the config for security gaps.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main: Results */}
            <div className="lg:col-span-2">
              {isAuditing ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px]">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <ShieldCheck className="w-10 h-10 text-blue-600 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-slate-800">Analyzing Security Posture...</h3>
                  <div className="mt-4 space-y-2 text-center text-slate-500">
                    <p className="flex items-center justify-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Connected to Auditor Engine</span>
                    </p>
                    <p className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                      <span>Agent fetching rulebase via API</span>
                    </p>
                  </div>
                </div>
              ) : report ? (
                <AuditReport report={report} />
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 flex flex-col items-center text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                  <h3 className="text-xl font-bold text-red-800">Audit Failed</h3>
                  <p className="text-red-600 mt-2 max-w-md">{error}</p>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-6">
                    <button 
                      onClick={() => setError(null)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Adjust Config
                    </button>
                    <button 
                      onClick={loadDemoAudit}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>Try Demo Mode Instead</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <FileSearch className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">Ready to Scan</h3>
                  <p className="text-slate-500 mt-4 max-w-md">
                    Enter your firewall details and n8n webhook URL on the left to begin an AI-driven security audit.
                  </p>
                  
                  <div className="mt-8 flex flex-col items-center space-y-4">
                     <button 
                      onClick={loadDemoAudit}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center space-x-2 group shadow-lg"
                    >
                      <Sparkles className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>Try Demo Mode (Mock Data)</span>
                    </button>
                    <p className="text-xs text-slate-400 italic">No configuration required for Demo Mode</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-lg text-left">
                    <div className="p-4 border border-slate-100 rounded-lg flex items-start space-x-3">
                      <Lock className="w-5 h-5 text-blue-500 mt-1" />
                      <div>
                        <p className="font-semibold text-slate-800">Secure Analysis</p>
                        <p className="text-xs text-slate-500">Agent identifies overly permissive rules & shadow policies.</p>
                      </div>
                    </div>
                    <div className="p-4 border border-slate-100 rounded-lg flex items-start space-x-3">
                      <Activity className="w-5 h-5 text-green-500 mt-1" />
                      <div>
                        <p className="font-semibold text-slate-800">Hardening Suggestions</p>
                        <p className="text-xs text-slate-500">Get specific CLI commands to patch vulnerabilities.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 text-slate-500">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm">© 2024 Sentinel AI Auditor. Professional Security Tool.</span>
          </div>
          <div className="flex space-x-6">
            <span className="text-slate-400 text-sm cursor-not-allowed">Documentation</span>
            <span className="text-slate-400 text-sm cursor-not-allowed">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const MOCK_REPORT_FORTINET: FirewallReport = {
  overallScore: 72,
  summary: "The FortiGate configuration shows a generally healthy posture but has several high-risk 'Any-Any' rules and outdated firmware. Several management services are exposed to the public internet.",
  deviceInfo: {
    hostname: "HQ-FW-01",
    firmware: "v7.2.4 Build 1530",
    uptime: "45 Days, 12 Hours"
  },
  findings: [
    {
      id: "1",
      title: "Publicly Accessible SSH Management",
      category: "Management",
      risk: RiskLevel.CRITICAL,
      description: "Management access via SSH is permitted from any source IP (0.0.0.0/0). This exposes the device to brute-force attacks.",
      recommendation: "Restrict management access to a trusted internal subnet or a specific VPN pool using 'set access-banner enable'."
    },
    {
      id: "2",
      title: "Permissive Rule: Guest-to-Internal",
      category: "Traffic Control",
      risk: RiskLevel.HIGH,
      description: "Policy ID 45 allows all traffic from Guest VLAN to the production Database server on port 3306.",
      recommendation: "Implement a specific rule allowing only necessary application ports and deny all other inter-VLAN traffic."
    },
    {
      id: "3",
      title: "Unencrypted Log Export",
      category: "Logging",
      risk: RiskLevel.MEDIUM,
      description: "Syslog is being exported via UDP port 514 without TLS encryption.",
      recommendation: "Switch to Reliable Syslog (TCP/6514) with TLS certificates."
    },
    {
      id: "4",
      title: "Expired Web Filter Licenses",
      category: "Compliance",
      risk: RiskLevel.LOW,
      description: "Category-based web filtering is currently disabled due to license expiration.",
      recommendation: "Renew FortiGuard subscriptions to re-enable malicious domain blocking."
    }
  ]
};

const MOCK_REPORT_PA: FirewallReport = {
  overallScore: 65,
  summary: "Palo Alto Networks audit reveals several security policies with 'service any' and lack of App-ID profile assignment. GlobalProtect is configured with weak ciphers.",
  deviceInfo: {
    hostname: "PA-VM-PRIMARY",
    firmware: "PAN-OS 10.1.6-h6",
    uptime: "128 Days, 4 Hours"
  },
  findings: [
    {
      id: "pa-1",
      title: "Implicit App-ID Overrides",
      category: "App-ID",
      risk: RiskLevel.HIGH,
      description: "Several rules use 'service any' instead of specific App-ID signatures, allowing non-standard traffic to bypass deep packet inspection.",
      recommendation: "Switch from 'service any' to application-default and specify required App-IDs like 'web-browsing' and 'ssl'."
    },
    {
      id: "pa-2",
      title: "Lack of Security Profiles",
      category: "Threat Prevention",
      risk: RiskLevel.CRITICAL,
      description: "Outbound internet policies lack Antivirus, Vulnerability Protection, and WildFire profiles.",
      recommendation: "Apply the 'Strict' security profile group to all rules allowing outbound traffic."
    },
    {
      id: "pa-3",
      title: "Weak GlobalProtect Ciphers",
      category: "Remote Access",
      risk: RiskLevel.MEDIUM,
      description: "SSL/TLS profile allows TLS 1.0 and 1.1 for GlobalProtect VPN connections.",
      recommendation: "Update the SSL/TLS Service Profile to restrict minimum version to TLS 1.2."
    }
  ]
};

export default App;
