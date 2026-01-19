
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw, Filter, XCircle, ShieldCheck, Database, Clock, Zap } from 'lucide-react';
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
  initialFilter?: string | null;
  onClearFilter?: () => void;
}

const MonitorTab: React.FC<MonitorTabProps> = ({ config: initialConfig, initialFilter, onClearFilter }) => {
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
      console.error("Failed to load historical logs:", err);
    }
  };

  useEffect(() => {
    fetchLogsFromDB();
    if (initialFilter) setActiveFilter(initialFilter);
  }, [initialFilter]);

  const handleFetchLogs = async () => {
    setIsFetching(true);
    setError(null);
    try {
      // Trigger the backend proxy, which hits n8n
      const response = await fetch(LOGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ipAddress: initialConfig.ipAddress, 
          apiKey: initialConfig.apiKey
        })
      });
      
      if (!response.ok) throw new Error("n8n Orchestration failed");
      
      // Since n8n handles the DB INSERT, we simply refresh our local view from the DB now
      await fetchLogsFromDB();
    } catch (err: any) {
      setError(err.message || "Failed to sync with n8n agent");
    } finally {
      setIsFetching(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!activeFilter) return logs;
    return logs.filter(log => 
      (log.config_path || '').toLowerCase().includes(activeFilter.toLowerCase()) ||
      (log.admin_user || '').toLowerCase().includes(activeFilter.toLowerCase())
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
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Audit Logs (n8n Managed)</h2>
                {activeFilter && (
                  <div className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    <Filter className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Filter: {activeFilter}</span>
                    <button onClick={() => { setActiveFilter(null); onClearFilter?.(); }}><XCircle className="w-3.5 h-3.5 hover:text-blue-900" /></button>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Orchestration flow: Agent -> n8n -> MySQL</span>
              </p>
            </div>
          </div>
          <button 
            onClick={handleFetchLogs} 
            disabled={isFetching} 
            className="px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black shadow-lg flex items-center space-x-3 transition-all active:scale-95"
          >
            {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Trigger n8n Sync</span>
          </button>
        </div>
        
        <div className="flex items-center space-x-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
           <div className="flex-1">
              <span className="text-[10px] block font-black text-slate-400 uppercase tracking-widest">Target IP</span>
              <span className="text-xs font-mono font-bold text-slate-700">{initialConfig.ipAddress || 'Not Set'}</span>
           </div>
           <div className="w-px h-8 bg-slate-200" />
           <div className="flex-1">
              <span className="text-[10px] block font-black text-slate-400 uppercase tracking-widest">DB Records</span>
              <span className="text-xs font-bold text-slate-700">{logs.length}</span>
           </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold border-b border-red-100">{error}</div>}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-left">Time</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-left">Admin</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-left">Action</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-left">Log Path & Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? filteredLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-4 text-[11px] font-mono text-slate-500 font-bold whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                       <Clock className="w-3 h-3 text-slate-300" />
                       <span>{new Date(log.receive_time).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                     <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 uppercase">{log.admin_user}</span>
                  </td>
                  <td className="px-4 py-4">
                     <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.command === 'edit' ? 'bg-amber-100 text-amber-700' : log.command === 'delete' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {log.command}
                     </span>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono line-clamp-1 text-slate-400 bg-slate-50 p-1 rounded italic">{log.config_path}</div>
                      {log.after_change && (
                        <div className="text-[10px] bg-emerald-50 text-emerald-700 p-2 rounded border border-emerald-100 font-mono">
                           <span className="font-black mr-2">CHANGED TO:</span>{log.after_change}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-40 text-center text-slate-300 uppercase tracking-widest text-[10px] font-black">No telemetry data found in database</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;
