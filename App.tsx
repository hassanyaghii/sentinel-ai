
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, Activity, History, Clock, ChevronRight } from 'lucide-react';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';
import { AuditConfig } from './types';

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

  const fetchArchive = async (loadLatest = false) => {
    try {
      const response = await fetch(`${API_BASE}/reports`);
      if (response.ok) {
        const data = await response.json();
        setDbReports(data);
        if (loadLatest && data.length > 0) {
          await loadArchiveDetail(data[0].id);
        }
        return data;
      }
    } catch (err) {
      console.error("Archive fetch error:", err);
    }
    return [];
  };

  const loadArchiveDetail = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/reports/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setActiveTab('audit');
        return data;
      }
    } catch (err) {
      console.error("Detail fetch error:", err);
      setError("Failed to load report details.");
    }
    return null;
  };

  const handleJumpToLogs = (path: string) => {
    setLogFilter(path);
    setActiveTab('monitor');
  };

  useEffect(() => {
    fetchArchive(true);
  }, []);

  useEffect(() => {
    if (activeTab === 'archive') fetchArchive();
  }, [activeTab]);

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setReport(null);
    setError(null);
    setIsAuditing(true);
    setActiveTab('audit');
    
    try {
      // 1. Trigger the n8n Agent via Backend Proxy
      const response = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${response.statusText}`);
      }

      // 2. Short delay to allow n8n to complete MySQL insertions
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Fetch the absolute latest record from the DB Archive
      const updatedArchives = await fetchArchive();
      if (updatedArchives && updatedArchives.length > 0) {
        // Automatically load and display the newest report found in the database
        await loadArchiveDetail(updatedArchives[0].id);
      } else {
        throw new Error("Audit finished but no record found in history database.");
      }
    } catch (err: any) {
      setError(`Audit Failed: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-slate-900 text-white border-b border-slate-700 h-16 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveTab('audit'); fetchArchive(true); }}>
              <ShieldCheck className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold tracking-tight">Sentinel <span className="text-blue-500 uppercase text-xs ml-1">PAN-OS</span></span>
            </div>
            <div className="flex space-x-1">
              <button onClick={() => { setActiveTab('audit'); setError(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>AI Audit</button>
              <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Archive</button>
              <button onClick={() => setActiveTab('monitor')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Telemetry</button>
              <button onClick={() => setActiveTab('explorer')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'explorer' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Explorer</button>
            </div>
          </div>
          <div className="hidden md:block text-[10px] bg-slate-800 px-3 py-1.5 rounded-full text-slate-400 font-mono border border-slate-700 uppercase tracking-widest">
             Management Proxy: 10.1.240.2
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
              {report && !isAuditing && report.id && (
                <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between shadow-lg">
                   <div className="flex items-center space-x-2">
                     <Database className="w-4 h-4 text-blue-400" />
                     <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">DB History ID:</span>
                   </div>
                   <span className="text-[10px] font-mono font-bold text-blue-400">REC_{report.id.toString().padStart(6, '0')}</span>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              {isAuditing ? (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border border-slate-200 shadow-sm text-center">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 border-4 border-slate-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <Activity className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Orchestrating Security Analysis</h3>
                  <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Analyzing Firewall Rules via n8n Agent
                  </p>
                  <div className="mt-8 flex gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                  </div>
                </div>
              ) : report ? <AuditReport report={report} /> : (
                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-slate-200 text-center shadow-inner">
                  <ShieldCheck className="w-16 h-16 text-slate-100 mb-4" />
                  <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">System Ready</h3>
                  <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Initiate audit to start persistent scan</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div><h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Audit History</h2><p className="text-xs text-slate-400 font-medium tracking-tighter">Results loaded from MySQL database</p></div>
            </div>
            <div className="p-6">
              {dbReports.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dbReports.map((r) => (
                    <div key={r.id} onClick={() => loadArchiveDetail(r.id)} className={`p-4 border rounded-xl transition-all flex items-center justify-between cursor-pointer group ${report?.id === r.id ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-400 hover:bg-white hover:shadow-md'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${r.overall_score > 60 ? 'bg-green-500' : r.overall_score > 40 ? 'bg-amber-500' : 'bg-red-500'}`}>{r.overall_score || 0}%</div>
                        <div>
                           <h4 className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{r.hostname || r.ip_address}</h4>
                           <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5"><Clock className="w-3 h-3"/> {new Date(r.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${report?.id === r.id ? 'text-blue-500 translate-x-1' : 'text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1'}`} />
                    </div>
                  ))}
                </div>
              ) : <div className="py-40 text-center opacity-30"><Database className="w-12 h-12 mx-auto mb-4" /><p className="font-black uppercase tracking-widest text-xs">No records in Database</p></div>}
            </div>
          </div>
        )}

        {activeTab === 'explorer' && <ConfigExplorer onJumpToLogs={handleJumpToLogs} sharedConfig={config} onConfigChange={setConfig} />}
        {activeTab === 'monitor' && <MonitorTab config={config} onConfigChange={setConfig} initialFilter={logFilter} onClearFilter={() => setLogFilter(null)} />}
      </main>
    </div>
  );
};

export default App;
