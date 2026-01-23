
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Activity, 
  History, 
  Clock, 
  ChevronRight, 
  LayoutDashboard, 
  Menu, 
  X, 
  Search,
  Settings,
  Shield,
  Monitor
} from 'lucide-react';
import SetupForm from './components/SetupForm';
import AuditReport from './components/AuditReport';
import ConfigExplorer from './components/ConfigExplorer';
import MonitorTab from './components/MonitorTab';
import DashboardTab from './components/DashboardTab';
import { AuditConfig } from './types';

const API_BASE = "/api";

const App: React.FC = () => {
  // Set Dashboard as the default tab as requested
  const [activeTab, setActiveTab] = useState<'audit' | 'archive' | 'explorer' | 'monitor' | 'dashboard'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
        if (loadLatest && data.length > 0 && activeTab === 'audit') {
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
    if (activeTab === 'archive' || activeTab === 'dashboard') fetchArchive();
  }, [activeTab]);

  const handleRunAudit = async (auditConfig: AuditConfig) => {
    setReport(null);
    setError(null);
    setIsAuditing(true);
    setActiveTab('audit');
    
    try {
      const response = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditConfig)
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${response.statusText}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedArchives = await fetchArchive();
      if (updatedArchives && updatedArchives.length > 0) {
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

  // Reordered and relabeled nav items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'audit', label: 'AI Audit', icon: ShieldCheck },
    { id: 'explorer', label: 'Config Explorer', icon: Search },
    { id: 'monitor', label: 'Configuration Logs', icon: Activity },
    { id: 'archive', label: 'Archive', icon: Database },
  ] as const;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-900 text-slate-400 transition-all duration-300 ease-in-out flex flex-col z-50`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center space-x-3 shrink-0">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            {isSidebarOpen && (
              <span className="text-xl font-bold text-white tracking-tight">Sentinel</span>
            )}
          </div>
        </div>

        <nav className="flex-grow py-6 space-y-2 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                if (item.id === 'audit') setError(null);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all group ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
              {isSidebarOpen && <span className="font-bold text-sm truncate">{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-20 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors group">
            <Settings className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />
            {isSidebarOpen && <span className="text-sm font-bold">Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-40">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {navItems.find(i => i.id === activeTab)?.label}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-[10px] bg-slate-100 px-3 py-1.5 rounded-full text-slate-500 font-mono border border-slate-200 uppercase tracking-widest">
               Local Node: 10.1.244.70
            </div>
          </div>
        </header>

        {/* Scrolling Main View */}
        <main className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold flex items-center justify-between">
                <span>⚠️ {error}</span>
                <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>
            )}

            {activeTab === 'dashboard' && <DashboardTab reports={dbReports} />}

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
                    </div>
                  ) : report ? <AuditReport report={report} /> : (
                    <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center min-h-[500px] border-dashed border-2 border-slate-200 text-center shadow-inner">
                      <Shield className="w-16 h-16 text-slate-100 mb-4" />
                      <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">System Ready</h3>
                      <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Initiate audit to start persistent scan</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'explorer' && <ConfigExplorer onJumpToLogs={handleJumpToLogs} sharedConfig={config} onConfigChange={setConfig} />}
            
            {activeTab === 'monitor' && <MonitorTab config={config} onConfigChange={setConfig} initialFilter={logFilter} onClearFilter={() => setLogFilter(null)} />}

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
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
