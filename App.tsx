import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  FileSearch,
  AlertTriangle,
  Database,
  LayoutDashboard,
  Activity
} from 'lucide-react';
import { AuditConfig, FirewallReport, RiskLevel } from './types';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';

const UI_BUILD_ID = "v2.6.0-MYSQL-SYNC";

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
    webhookUrl: ''
  });

  const navigateToMonitor = (path: string) => {
    setFilterPath(path);
    setActiveTab('monitor');
  };

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    setReport(null);
    setConfig(auditConfig);

    try {
      const response = await fetch(auditConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });
      if (!response.ok) throw new Error(`n8n connection failed: HTTP ${response.status}`);
      const rawResponse = await response.json();
      let data = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;
      if (data?.json) data = data.json;
      
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to communicate with n8n Agent.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-8 h-8 text-blue-400" />
                <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-400">AI</span></span>
              </div>
              <div className="hidden md:flex space-x-1">
                <button 
                  onClick={() => { setActiveTab('audit'); setFilterPath(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Audit Dashboard</span>
                </button>
                <button 
                  onClick={() => setActiveTab('monitor')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Live Monitor</span>
                </button>
                <button 
                  onClick={() => { setActiveTab('explorer'); setFilterPath(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'explorer' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Database className="w-4 h-4" />
                  <span>Config Manager</span>
                </button>
              </div>
            </div>
            <div className="text-[10px] bg-slate-800 px-3 py-1 rounded text-slate-400 font-mono tracking-widest border border-slate-700">
              {UI_BUILD_ID}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-blue-500" />
                  <span>Security Console</span>
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[600px]">
                  <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <h3 className="mt-8 text-xl font-bold text-slate-900">Syncing with DB...</h3>
                </div>
              ) : report ? (
                <AuditReport report={report} />
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-10 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-red-900">Sync Failed</h3>
                  <p className="text-red-700/80 mt-2 text-sm">{error}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center min-h-[600px] text-center border-dashed border-2">
                  <FileSearch className="w-16 h-16 text-slate-200 mb-6" />
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">MySQL Active</h3>
                  <p className="text-slate-500 mt-3 max-w-sm mx-auto uppercase font-black text-[10px] tracking-widest text-blue-600">
                    Database connected and ready for persistence
                  </p>
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