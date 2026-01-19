
import React, { useState } from 'react';
import { ShieldCheck, Database, LayoutDashboard, Activity, AlertTriangle } from 'lucide-react';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';
import { AuditConfig } from './types';

// Reverted to direct n8n production webhook
const AUDIT_WEBHOOK = "https://10.1.240.2/webhook/analyze-firewall";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'explorer' | 'monitor'>('audit');
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterPath, setFilterPath] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AuditConfig>({
    ipAddress: '',
    apiKey: '',
    vendor: 'paloalto',
    webhookUrl: AUDIT_WEBHOOK
  });

  const navigateToMonitor = (path: string) => {
    setFilterPath(path);
    setActiveTab('monitor');
  };

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    setReport(null);
    
    try {
      const response = await fetch(AUDIT_WEBHOOK, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ipAddress: auditConfig.ipAddress,
          apiKey: auditConfig.apiKey,
          vendor: auditConfig.vendor
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent Error (${response.status}): ${errorText || 'Check n8n connectivity'}`);
      }

      const rawData = await response.json();
      
      // Unwrap n8n standard output structures
      let processedReport = rawData;
      if (Array.isArray(rawData)) processedReport = rawData[0];
      processedReport = processedReport?.body ?? processedReport?.data ?? processedReport?.output ?? processedReport;

      if (!processedReport || typeof processedReport !== 'object') {
        throw new Error("Invalid response from AI Agent. Expected JSON object.");
      }

      setReport(processedReport);
    } catch (err: any) {
      console.error("Audit Connection Error:", err);
      setError(err.message || "Could not communicate with 10.1.240.2");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-slate-900 text-white border-b border-slate-700 h-16 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-500 uppercase text-sm ml-1">Enterprise</span></span>
            </div>
            <div className="flex space-x-1">
              <button onClick={() => setActiveTab('audit')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-600 shadow-lg' : 'text-slate-400 hover:text-white'}`}>AI Audit</button>
              <button onClick={() => setActiveTab('monitor')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'monitor' ? 'bg-blue-600 shadow-lg' : 'text-slate-400 hover:text-white'}`}>Live Telemetry</button>
              <button onClick={() => setActiveTab('explorer')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'explorer' ? 'bg-blue-600 shadow-lg' : 'text-slate-400 hover:text-white'}`}>Config Explorer</button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] bg-slate-800 px-3 py-1.5 rounded-full text-slate-400 font-mono border border-slate-700">
              AGENT HOST: 10.1.240.2
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <SetupForm onSubmit={handleRunAudit} isLoading={isAuditing} initialValues={config} onConfigChange={setConfig} />
            </div>
            <div className="lg:col-span-2">
              {isAuditing ? (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] shadow-sm border border-slate-200">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <ShieldCheck className="w-6 h-6 text-blue-600 absolute inset-0 m-auto" />
                  </div>
                  <h3 className="mt-8 text-lg font-bold text-slate-900 uppercase tracking-widest text-center">AI Agent Analysis...</h3>
                  <p className="text-slate-400 text-sm mt-2 font-medium text-center">Contacting n8n at 10.1.240.2</p>
                </div>
              ) : report ? (
                <AuditReport report={report} />
              ) : error ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-red-900">Agent Communication Error</h3>
                  <p className="text-red-600 mt-2 text-sm">{error}</p>
                  <button onClick={() => handleRunAudit(config)} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-xs uppercase">Retry Agent</button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-slate-200">
                  <ShieldCheck className="w-20 h-20 text-slate-100 mb-6" />
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight">System Ready</h3>
                  <p className="text-slate-400 mt-2 text-sm max-w-xs text-center">Configure the target firewall to begin the direct n8n security audit.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'explorer' && <ConfigExplorer onRuleSelect={navigateToMonitor} />}
        {activeTab === 'monitor' && <MonitorTab config={config} initialFilter={filterPath} onClearFilter={() => setFilterPath(null)} />}
      </main>
    </div>
  );
};

export default App;
