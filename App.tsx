import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  FileSearch, 
  AlertTriangle 
} from 'lucide-react';
import { AuditConfig, FirewallReport } from './types';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';

const App: React.FC = () => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<FirewallReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuditConfig>({
    ipAddress: '',
    apiKey: '',
    vendor: 'paloalto',
    webhookUrl: ''
  });

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    setReport(null); // Clear previous results to prevent UI flicker
    setConfig(auditConfig);

    try {
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });

      if (!response.ok) {
        throw new Error(`Connection Error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log("📥 Raw Payload from n8n:", rawData);

      // 🛡️ THE ARRAY UNWRAPPER (Final Fix)
      // This loop digs through any number of arrays (e.g., [[{...}]]) 
      // until it reaches the actual JSON object.
      let processedData = rawData;
      while (Array.isArray(processedData)) {
        processedData = processedData[0];
      }

      // Final check: Did we find an object?
      if (!processedData || typeof processedData !== 'object') {
        throw new Error("Audit failed: The AI response was not a valid object.");
      }

      // Ensure 'findings' exists as an array to prevent crashes in the Report component
      const validatedReport: FirewallReport = {
        ...processedData,
        findings: Array.isArray(processedData.findings) ? processedData.findings : []
      };

      setReport(validatedReport);
      
    } catch (err: any) {
      console.error("❌ Audit Logic Error:", err);
      setError(err.message || "An unexpected error occurred during the analysis.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navbar */}
      <nav className="bg-slate-900 text-white h-16 flex items-center px-8 border-b border-slate-700 shadow-lg">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">
            Sentinel <span className="text-blue-400">AI</span> Auditor
          </span>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar: Form */}
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

        {/* Right Content: Results & States */}
        <div className="lg:col-span-2">
          {isAuditing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[500px]">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <h3 className="mt-6 text-xl font-bold text-slate-800 animate-pulse">Running Security Audit...</h3>
              <p className="text-slate-500 mt-2 text-center max-w-sm italic">
                Our Agent is currently analyzing your rulebase for misconfigurations.
              </p>
            </div>
          ) : report ? (
            <div className="animate-in fade-in duration-500">
              <AuditReport report={report} />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-800">Connection Failed</h3>
              <p className="text-red-600 mt-2 max-w-md mx-auto">{error}</p>
              <button 
                onClick={() => setError(null)} 
                className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-transform active:scale-95"
              >
                Clear & Retry
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center min-h-[500px] flex flex-col items-center justify-center">
              <FileSearch className="w-20 h-20 text-slate-100 mb-6" />
              <h3 className="text-2xl font-bold text-slate-800">No Data Available</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                Please enter your firewall details and click "Run Audit" to generate a security health report.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-slate-400 text-xs border-t border-slate-200 bg-white">
        &copy; 2026 Sentinel Security AI — Network Auditor Enterprise
      </footer>
    </div>
  );
};

export default App;