
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, Activity, History, Clock, ChevronRight } from 'lucide-react';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';
import { AuditConfig } from './types';

// Points to the server.js proxy
const API_BASE = "/api";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'archive' | 'explorer' | 'monitor'>('audit');
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AuditConfig>({
    ipAddress: '',
    apiKey: '',
    vendor: 'paloalto',
    webhookUrl: ''
  });

  const fetchArchive = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports`);
      if (response.ok) {
        const data = await response.json();
        setDbReports(data);
      }
    } catch (err) {
      console.error("Archive fetch error:", err);
    }
  };

  const loadArchiveDetail = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/reports/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setActiveTab('audit');
      }
    } catch (err) {
      console.error("Detail fetch error:", err);
    }
  };

  const handleJumpToLogs = (path: string) => {
    setLogFilter(path);
    setActiveTab('monitor');
  };

  useEffect(() => {
    if (activeTab === 'archive') fetchArchive();
  }, [activeTab]);

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setIsAuditing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });
      
      if (!response.ok) {
        throw new Error(`Server Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error("Audit Request Failed:", err);
      setError(`Failed to trigger n8n audit: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-slate-900 text-white border-b border-slate-700 h-16 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveTab('audit'); setReport(null); }}>
              <ShieldCheck className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-500 uppercase text-xs ml-1">PAN-OS</span></span>
            </div>
            <div className="flex space-x-1">
              <button onClick={() => { setActiveTab('audit'); setReport(null); setError(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>AI Audit</button>
              <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Archive</button>
              <button onClick={() => setActiveTab('monitor')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Telemetry</button>
              <button onClick={() => setActiveTab('explorer')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'explorer' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Explorer</button>
            </div>
          </div>
          <div className="hidden md:block text-[10px] bg-slate-800 px-3 py-1.5 rounded-full text-slate-400 font-mono border border-slate-700">
             AGENT ACTIVE: 10.1.240.2
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold animate-in slide-in-from-top-2">
            ⚠️ {error}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <SetupForm onSubmit={handleRunAudit} isLoading={isAuditing} initialValues={config} onConfigChange={setConfig} />
            </div>
            <div className="lg:col-span-2">
              {isAuditing ? (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <h3 className="mt-8 text-lg font-black text-slate-900 uppercase tracking-widest">n8n: Analyzing Config...</h3>
                  <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Waiting for AI Agent response</p>
                </div>
              ) : report ? (
                <AuditReport report={report} />
              ) : (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-slate-200 text-center shadow-inner">
                  <Activity className="w-16 h-16 text-slate-100 mb-4" />
                  <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">Scanner Idle</h3>
                  <p className="text-sm text-slate-400 mt-1">Enter firewall details to begin audit</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Audit History</h2>
                <p className="text-xs text-slate-400 font-medium tracking-tighter">Results loaded from MySQL database</p>
              </div>
            </div>
            <div className="p-6">
              {dbReports.length > 0 ? (
                <div className="space-y-3">
                  {dbReports.map((r) => (
                    <div key={r.id} onClick={() => loadArchiveDetail(r.id)} className="p-4 border border-slate-100 rounded-xl hover:border-blue-400 hover:bg-blue-50/20 transition-all flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm ${r.overall_score > 60 ? 'bg-green-500' : r.overall_score > 40 ? 'bg-orange-500' : 'bg-red-500'}`}>
                          {r.overall_score}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{r.hostname || 'Device'} ({r.ip_address})</h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            <Clock className="w-3 h-3"/> {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-40 text-center opacity-30"><Database className="w-12 h-12 mx-auto mb-4" /><p className="font-black uppercase tracking-widest text-xs">No records in Database</p></div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'explorer' && <ConfigExplorer onJumpToLogs={handleJumpToLogs} />}
        {activeTab === 'monitor' && <MonitorTab config={config} initialFilter={logFilter} onClearFilter={() => setLogFilter(null)} />}
      </main>
    </div>
  );
};

export default App;
