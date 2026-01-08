
import React, { useState, useEffect } from 'react';
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

const APP_VERSION = "1.3.0-ULTRA-SAFE";

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

  useEffect(() => {
    console.log(`%c Sentinel AI ${APP_VERSION} Loaded `, "background: #1e293b; color: #38bdf8; font-weight: bold; padding: 4px; border-radius: 4px;");
  }, []);

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    setReport(null);
    setConfig(auditConfig);

    // Demo Mode
    if (auditConfig.webhookUrl.includes('example.com') || auditConfig.webhookUrl.includes('test-audit')) {
      setTimeout(() => {
        setReport(MOCK_REPORT_FORTINET);
        setIsAuditing(false);
      }, 1000);
      return;
    }

    try {
      console.log("Fetching from n8n...");
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });

      if (!response.ok) {
        throw new Error(`n8n response error: ${response.status}`);
      }

      const data = await response.json();
      console.log("RAW DATA FROM N8N:", data);
      
      // 1. NORMALIZE: n8n often returns [ { ... } ]
      let rawObj = Array.isArray(data) ? data[0] : data;
      
      // 2. SEARCH: If n8n nested the result (common in AI nodes)
      if (rawObj?.json) rawObj = rawObj.json;
      else if (rawObj?.body) rawObj = rawObj.body;
      else if (rawObj?.output) rawObj = rawObj.output;

      // 3. VALIDATE & REPAIR: Ensure the object is not 'undefined' and has 'findings'
      if (!rawObj || typeof rawObj !== 'object') {
        throw new Error("The AI Agent did not return a valid JSON object. Check your n8n 'Respond to Webhook' node.");
      }

      const safeReport: FirewallReport = {
        overallScore: Number(rawObj.overallScore) || 0,
        summary: String(rawObj.summary || "No summary provided."),
        // CRITICAL FIX: Ensure findings is NEVER undefined
        findings: Array.isArray(rawObj.findings) ? rawObj.findings : [],
        deviceInfo: rawObj.deviceInfo || { hostname: 'Unknown', firmware: 'Unknown', uptime: 'Unknown' }
      };

      console.log("FINAL VALIDATED REPORT:", safeReport);
      setReport(safeReport);
    } catch (err: any) {
      console.error("CRITICAL ERROR:", err);
      setError(err.message || "Unknown error occurred.");
    } finally {
      setIsAuditing(false);
    }
  };

  const loadDemoAudit = () => {
    setIsAuditing(true);
    setError(null);
    setReport(null);
    setTimeout(() => {
      setReport(MOCK_REPORT_FORTINET);
      setIsAuditing(false);
    }, 500);
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
            <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">SAFE_MODE v1.3</div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-blue-500" />
                <span>Configuration</span>
              </h2>
              <SetupForm 
                onSubmit={handleRunAudit} 
                isLoading={isAuditing} 
                initialValues={config} 
                onConfigChange={setConfig}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            {isAuditing ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h3 className="mt-6 text-lg font-bold text-slate-800">Agent Processing Data...</h3>
              </div>
            ) : report ? (
              <AuditReport report={report} />
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-800">Audit Processing Error</h3>
                <p className="text-red-600 mt-2">{error}</p>
                <button onClick={() => setError(null)} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg">Reset & Try Again</button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px] text-center">
                <FileSearch className="w-16 h-16 text-slate-200 mb-6" />
                <h3 className="text-2xl font-bold text-slate-800">Ready to Scan</h3>
                <p className="text-slate-500 mt-2 max-w-md">Connect to your n8n workflow to analyze your firewall configuration.</p>
                <button onClick={loadDemoAudit} className="mt-8 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center space-x-2 shadow-lg hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <span>Use Demo Mock Data</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const MOCK_REPORT_FORTINET: FirewallReport = {
  overallScore: 72,
  summary: "Mock summary for demo purposes.",
  deviceInfo: { hostname: "DEMO-FW", firmware: "v1.0", uptime: "1 Day" },
  findings: [
    { id: "1", title: "Demo Finding", category: "Test", risk: RiskLevel.MEDIUM, description: "This is mock data.", recommendation: "No action needed." }
  ]
};

export default App;
