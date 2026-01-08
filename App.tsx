import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  FileSearch, 
  AlertTriangle, 
  Sparkles 
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
    setReport(null); // Clear previous reports to prevent UI conflicts
    setConfig(auditConfig);

    try {
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });

      if (!response.ok) throw new Error(`Server connection failed: ${response.status}`);

      const rawData = await response.json();
      
      // 1️⃣ HANDLE N8N ARRAY WRAPPER
      // n8n sends [{...}], so we extract the first item.
      const data = Array.isArray(rawData) ? rawData[0] : rawData;

      if (!data) throw new Error("n8n returned an empty response.");

      // 2️⃣ DATA NORMALIZATION (The Safety Shield)
      // This maps the n8n JSON into exactly what the Frontend expects.
      const normalizedReport: FirewallReport = {
        overallScore: Number(data.overallScore) || 0,
        summary: data.summary || "No summary provided by the audit engine.",
        deviceInfo: {
          hostname: data.deviceInfo?.hostname || "N/A",
          firmware: data.deviceInfo?.firmware || "N/A",
          uptime: data.deviceInfo?.uptime || "N/A"
        },
        // 🛡️ CRITICAL FIX: Ensures findings is ALWAYS an array, never undefined
        findings: Array.isArray(data.findings) ? data.findings.map((f: any, index: number) => ({
          id: f.id || `finding-${index}`,
          title: f.title || "Untitled Finding",
          category: f.category || "General",
          // Force risk to match our RiskLevel enum, even if AI uses different casing
          risk: (String(f.risk).toUpperCase() as RiskLevel) || RiskLevel.LOW,
          description: f.description || "No description provided.",
          recommendation: f.recommendation || "No recommendation provided."
        })) : []
      };

      console.log("DEBUG: Final Normalized Report:", normalizedReport);
      setReport(normalizedReport);
      
    } catch (err: any) {
      console.error("Audit processing error:", err);
      setError(err.message || "An unexpected error occurred during the audit.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Navigation Header */}
      <nav className="bg-slate-900 text-white h-16 flex items-center px-8 border-b border-slate-700 shadow-md">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">
            Sentinel <span className="text-blue-400">AI</span> Auditor
          </span>
        </div>
      </nav>

      {/* Main Content Grid */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Settings */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-8">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
               <Terminal className="w-5 h-5 text-blue-600" /> Connection Details
            </h2>
            <SetupForm 
              onSubmit={handleRunAudit} 
              isLoading={isAuditing} 
              initialValues={config} 
              onConfigChange={setConfig} 
            />
          </div>
        </div>

        {/* Right Column: Results Area */}
        <div className="lg:col-span-2">
          {isAuditing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <h3 className="mt-6 text-xl font-bold text-slate-800 animate-pulse">Analyzing Rulebase...</h3>
              <p className="text-slate-500 mt-2 text-center max-w-sm">
                Our AI Agent is fetching your configuration and scanning for security vulnerabilities.
              </p>
            </div>
          ) : report ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AuditReport report={report} />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-800">Processing Failed</h3>
              <p className="text-red-600 mt-2 max-w-md mx-auto">{error}</p>
              <button 
                onClick={() => setError(null)} 
                className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Clear Error & Retry
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center min-h-[500px] flex flex-col items-center justify-center">
              <FileSearch className="w-20 h-20 text-slate-200 mb-6" />
              <h3 className="text-2xl font-bold text-slate-800">No Active Audit</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                Fill in your firewall credentials on the left to start a real-time AI security analysis.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm border-t border-slate-200">
        &copy; 2026 Sentinel Security AI — Firewall Auditor Professional
      </footer>
    </div>
  );
};

export default App;