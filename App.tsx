
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
    setReport(null); // Clear previous report to prevent stale data issues
    setConfig(auditConfig);

    // Demo Mode Handler
    if (auditConfig.webhookUrl.includes('example.com') || auditConfig.webhookUrl.includes('test-audit')) {
      setTimeout(() => {
        setReport(auditConfig.vendor === 'paloalto' ? MOCK_REPORT_PA : MOCK_REPORT_FORTINET);
        setIsAuditing(false);
      }, 1500);
      return;
    }

    try {
      if (!auditConfig.webhookUrl) {
        throw new Error("n8n Webhook URL is required.");
      }

      console.log("Initiating audit request to:", auditConfig.webhookUrl);
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });

      if (!response.ok) {
        throw new Error(`n8n Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Raw data received from n8n:", data);
      
      // Robust n8n response normalization
      let reportData: any = null;
      
      if (Array.isArray(data)) {
        // Typical n8n: array of items
        reportData = data[0];
      } else if (data && typeof data === 'object') {
        // Check if data is wrapped in a property like 'data' or 'body'
        if (data.data && Array.isArray(data.data)) reportData = data.data[0];
        else if (data.body) reportData = data.body;
        else reportData = data;
      }

      if (!reportData || typeof reportData !== 'object') {
        console.error("Failed to normalize report data:", data);
        throw new Error("The AI Agent returned data in an unrecognized format. Check the n8n workflow output.");
      }

      // Final check for expected properties to ensure it's actually the report
      if (!('findings' in reportData) && !('overallScore' in reportData)) {
        console.warn("Report data missing expected fields, searching deeper...", reportData);
        // Sometimes n8n puts the actual output inside a 'json' or 'output' property
        if (reportData.json) reportData = reportData.json;
        else if (reportData.output) reportData = reportData.output;
      }

      console.log("Successfully normalized report:", reportData);
      setReport(reportData);
    } catch (err: any) {
      console.error("Audit processing error:", err);
      setError(err.message || "An unexpected error occurred during the audit.");
    } finally {
      setIsAuditing(false);
    }
  };

  const loadDemoAudit = () => {
    setIsAuditing(true);
    setError(null);
    setReport(null);
    setTimeout(() => {
      setReport(config.vendor === 'paloalto' ? MOCK_REPORT_PA : MOCK_REPORT_FORTINET);
      setIsAuditing(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                    <p className="font-semibold mb-1 text-xs uppercase tracking-wider">Help</p>
                    <p className="opacity-90 text-xs">Ensure your n8n Webhook is set to "Respond: Using 'Respond to Webhook' Node" for best results.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {isAuditing ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px]">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <ShieldCheck className="w-10 h-10 text-blue-600 absolute inset-0 m-auto animate-pulse" />
                </div>
                <h3 className="mt-8 text-xl font-bold text-slate-800">Running AI Security Audit...</h3>
                <p className="text-slate-500 mt-2">Connecting to your n8n agent</p>
              </div>
            ) : report ? (
              <AuditReport report={report} />
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-8 flex flex-col items-center text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-800">Audit Failed</h3>
                <p className="text-red-600 mt-2 max-w-md">{error}</p>
                <div className="flex space-x-4 mt-6">
                  <button onClick={() => setError(null)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Try Again</button>
                  <button onClick={loadDemoAudit} className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center space-x-2"><Sparkles className="w-4 h-4 text-blue-400"/><span>Demo Mode</span></button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
                <FileSearch className="w-16 h-16 text-slate-200 mb-6" />
                <h3 className="text-2xl font-bold text-slate-800">No Audit Active</h3>
                <p className="text-slate-500 mt-2 max-w-md">Configure your connection details to the left and initiate a scan to see security findings.</p>
                <button onClick={loadDemoAudit} className="mt-8 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 flex items-center space-x-2 shadow-lg group">
                  <Sparkles className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>Explore with Demo Data</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-xs">
          © 2024 Sentinel AI Firewall Auditor.
        </div>
      </footer>
    </div>
  );
};

// Mock data constants...
const MOCK_REPORT_FORTINET: FirewallReport = {
  overallScore: 72,
  summary: "The FortiGate configuration shows a generally healthy posture but has several high-risk 'Any-Any' rules and outdated firmware.",
  deviceInfo: { hostname: "HQ-FW-01", firmware: "v7.2.4", uptime: "45 Days" },
  findings: [
    { id: "1", title: "Public SSH Access", category: "Management", risk: RiskLevel.CRITICAL, description: "SSH is open to the world.", recommendation: "Restrict to management subnet." },
    { id: "2", title: "Permissive Rule", category: "Traffic", risk: RiskLevel.HIGH, description: "Any-Any rule detected.", recommendation: "Apply principle of least privilege." }
  ]
};

const MOCK_REPORT_PA: FirewallReport = {
  overallScore: 65,
  summary: "Palo Alto Networks audit reveals several security policies with 'service any' and lack of App-ID profile assignment.",
  deviceInfo: { hostname: "PA-VM-01", firmware: "PAN-OS 10.1", uptime: "128 Days" },
  findings: [
    { id: "pa-1", title: "App-ID Bypass", category: "Security", risk: RiskLevel.HIGH, description: "Rules using service-any bypass App-ID checks.", recommendation: "Switch to application-default." }
  ]
};

export default App;