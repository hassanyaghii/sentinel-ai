
import React, { useState } from 'react';
import { ShieldCheck, Database, LayoutDashboard, Activity, AlertTriangle } from 'lucide-react';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';
import { AuditConfig } from './types';

const SERVER_IP = "10.1.244.70";
const BACKEND_URL = `http://${SERVER_IP}:3001`;

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
    webhookUrl: `${BACKEND_URL}/api/audit`
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
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });
      if (!response.ok) throw new Error(`Server Error: ${response.status}`);
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Cannot reach server API.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-slate-900 text-white border-b border-slate-700 h-16 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-400">AI</span></span>
            </div>
            <div className="flex space-x-1">
              <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'audit' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Audit</button>
              <button onClick={() => setActiveTab('monitor')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'monitor' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Monitor</button>
              <button onClick={() => setActiveTab('explorer')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'explorer' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Explorer</button>
            </div>
          </div>
          <div className="text-[10px] bg-slate-800 px-3 py-1 rounded text-slate-400 font-mono">NODE_IP: {SERVER_IP}</div>
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
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] shadow-sm border">
                  <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="font-bold text-slate-900">SAVING TO MYSQL AT {SERVER_IP}...</p>
                </div>
              ) : report ? (
                <AuditReport report={report} />
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-10 text-center">
                  <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                  <p className="text-red-700 font-bold">{error}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2">
                  <ShieldCheck className="w-16 h-16 text-slate-200 mb-4" />
                  <h3 className="text-xl font-bold text-slate-400">Ready for Server Audit</h3>
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
