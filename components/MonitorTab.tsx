
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw, Filter, XCircle, Clock, Zap, Server, Key, Search, Download, ShieldCheck, Database } from 'lucide-react';
import { AuditConfig } from '../types';

const LOGS_API = "/api/logs";

interface ConfigLog {
  id?: number;
  receive_time: string;
  admin_user: string;
  ip_address: string;
  client_type: string;
  command: string;
  result: string;
  config_path: string;
  before_change: string;
  after_change: string;
  sequence_no: string;
}

interface MonitorTabProps {
  config: AuditConfig;
  onConfigChange: (config: AuditConfig) => void;
  initialFilter?: string | null;
  onClearFilter?: () => void;
}

const MonitorTab: React.FC<MonitorTabProps> = ({ config, onConfigChange, initialFilter, onClearFilter }) => {
  const [logs, setLogs] = useState<ConfigLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(initialFilter || null);

  const fetchLogsFromDB = async () => {
    try {
      const response = await fetch(LOGS_API);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to load historical logs from DB:", err);
    }
  };

  useEffect(() => {
    fetchLogsFromDB();
    if (initialFilter) setActiveFilter(initialFilter);
  }, [initialFilter]);

  const handleFetchLogs = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config.ipAddress || !config.apiKey) {
      setError("Firewall IP and API Key are required to sync logs.");
      return;
    }
    
    setIsFetching(true);
    setError(null);
    
    try {
      const response = await fetch(LOGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ipAddress: config.ipAddress, 
          apiKey: config.apiKey
        })
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "n8n Orchestration for logs failed");
      }
      
      // Give n8n a small window to finish the MySQL insert before we refresh
      setTimeout(() => {
        fetchLogsFromDB();
        setIsFetching(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to sync with n8n agent @ 10.1.240.2");
      setIsFetching(false);
      fetchLogsFromDB();
    }
  };

  const filteredLogs = useMemo(() => {
    if (!activeFilter) return logs;
    const term = activeFilter.toLowerCase();
    return logs.filter(log => 
      (log.config_path || '').toLowerCase().includes(term) ||
      (log.admin_user || '').toLowerCase().includes(term) ||
      (log.command || '').toLowerCase().includes(term)
    );
  }, [logs, activeFilter]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl text-white shadow-lg bg-blue-600"><Activity className="w-6 h-6" /></div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Audit Logs</h2>
                {activeFilter && (
                  <div className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 shadow-sm">
                    <Filter className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filter: {activeFilter}</span>
                    <button onClick={() => { setActiveFilter(null); onClearFilter?.(); }} className="hover:scale-110 transition-transform"><XCircle className="w-4 h-4 text-blue-400 hover:text-blue-900" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={() => handleFetchLogs()} 
            disabled={isFetching} 
            className="px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black shadow-lg flex items-center space-x-3 transition-all active:scale-95 disabled:bg-slate-300"
          >
            {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{isFetching ? 'Syncing...' : 'Sync Logs Now'}</span>
          </button>
        </div>
        
        {/* CREDENTIALS FORM */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
           <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden px-3 shadow-inner">
              <Server className="w-4 h-4 text-slate-300 mr-2" />
              <input 
                type="text" placeholder="Device IP Address" value={config.ipAddress} 
                onChange={(e) => onConfigChange({...config, ipAddress: e.target.value})}
                className="w-full py-2.5 text-[11px] font-mono font-bold outline-none text-slate-700"
              />
           </div>
           <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden px-3 shadow-inner">
              <Key className="w-4 h-4 text-slate-300 mr-2" />
              <input 
                type="password" placeholder="Management API Key" value={config.apiKey} 
                onChange={(e) => onConfigChange({...config, apiKey: e.target.value})}
                className="w-full py-2.5 text-[11px] outline-none text-slate-700"
              />
           </div>
           <div className="h-10 w-px bg-slate-200" />
           <div className="flex items-center gap-3 pl-2">
              <div className="text-center">
                 <span className="text-[9px] block font-black text-slate-400 uppercase tracking-widest">Historical Records</span>
                 <span className="text-xs font-black text-blue-600">{logs.length}</span>
              </div>
              <Database className="w-5 h-5 text-slate-300" />
           </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-[11px] font-black uppercase border-b border-red-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="ml-auto underline">Clear</button>
          </div>
        )}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {isFetching && logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orchestrating Telemetry Fetch via n8n...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Receive Time</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Administrator</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Operation</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-left tracking-widest">Object Path & Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length > 0 ? filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-500 font-bold whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                         <Clock className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                         <span>{new Date(log.receive_time).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 uppercase shadow-sm group-hover:bg-white transition-colors">{log.admin_user}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${log.command === 'edit' ? 'bg-amber-100 text-amber-700' : log.command === 'delete' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {log.command || 'Unknown'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-1 italic group-hover:border-blue-100 transition-colors">
                          {log.config_path}
                        </div>
                        {log.after_change && (
                          <div className="text-[10px] bg-emerald-50 text-emerald-700 p-2 rounded-lg border border-emerald-100/50 font-mono shadow-sm">
                             <span className="font-black mr-2 opacity-50 underline">NEW VALUE:</span>
                             {log.after_change}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-40 text-center">
                       <Database className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                       <p className="text-slate-300 uppercase tracking-widest text-[11px] font-black">No telemetry data found in sentinel_audit.firewall_logs</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;
