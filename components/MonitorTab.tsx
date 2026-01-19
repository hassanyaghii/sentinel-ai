import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Monitor, 
  Server, 
  Key, 
  Globe,
  ShieldAlert,
  Zap,
  Lock,
  Unlock,
  Filter,
  XCircle
} from 'lucide-react';
import { AuditConfig } from '../types';

interface ConfigLog {
  time: string;
  admin: string;
  host: string;
  client: string;
  cmd: string;
  result: string;
  path: string;
  before: string;
  after: string;
  sequence: string;
}

interface MonitorTabProps {
  config: AuditConfig;
  initialFilter?: string | null;
  onClearFilter?: () => void;
}

const MonitorTab: React.FC<MonitorTabProps> = ({ config: initialConfig, initialFilter, onClearFilter }) => {
  const [localConfig, setLocalConfig] = useState<AuditConfig>(initialConfig);
  const [logs, setLogs] = useState<ConfigLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bypassCORS, setBypassCORS] = useState(false);

  // Filter state for rule drilling
  const [activeFilter, setActiveFilter] = useState<string | null>(initialFilter || null);

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFetchLogs = async () => {
    setIsFetching(true);
    setError(null);
    try {
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': bypassCORS ? 'text/plain' : 'application/json' },
        body: JSON.stringify({ fw_ip: localConfig.ipAddress, api_key: localConfig.apiKey, action: 'get_logs' }),
        mode: 'cors'
      };

      const response = await fetch(localConfig.webhookUrl, fetchOptions);
      const rawData = await response.json();
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
      const resultData = data.response?.result?.log?.logs?.entry || data.response?.result?.log?.entry || data.entry || data;
      const entries = Array.isArray(resultData) ? resultData : [resultData];

      const parsedLogs: ConfigLog[] = entries.map((entry: any) => ({
        time: entry.receive_time || 'N/A',
        admin: entry.admin || 'N/A',
        host: entry.host || localConfig.ipAddress,
        client: entry.client || 'N/A',
        cmd: entry.cmd || 'N/A',
        result: entry.result || 'N/A',
        path: entry.path || '',
        before: entry['before-change-preview'] || entry['before-change'] || '',
        after: entry['after-change-preview'] || entry['after-change'] || '',
        sequence: entry.seqno || ''
      }));

      setLogs(parsedLogs);
    } catch (err: any) {
      setError(err.message || "Connection refused.");
    } finally {
      setIsFetching(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!activeFilter) return logs;
    return logs.filter(log => 
      log.path.toLowerCase().includes(activeFilter.toLowerCase())
    );
  }, [logs, activeFilter]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl text-white shadow-lg transition-colors ${bypassCORS ? 'bg-orange-500' : 'bg-slate-900'}`}>
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Audit Monitor</h2>
                {activeFilter && (
                  <div className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse border border-blue-200">
                    <Filter className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Filtered: {activeFilter}</span>
                    <button onClick={() => { setActiveFilter(null); onClearFilter?.(); }}>
                      <XCircle className="w-3.5 h-3.5 hover:text-blue-900" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Live Telemetry Link</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setBypassCORS(!bypassCORS)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border-2 transition-all ${bypassCORS ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
              {bypassCORS ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-widest">Bypass CORS</span>
            </button>

            <button 
              onClick={handleFetchLogs}
              disabled={isFetching}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg flex items-center space-x-3`}
            >
              {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isFetching ? 'Fetching...' : 'Fetch Logs'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1"><Server className="w-3 h-3" /><span>Firewall Host</span></label>
            <input type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl font-mono focus:ring-4 focus:ring-blue-50 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1"><Key className="w-3 h-3" /><span>API Key</span></label>
            <input type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1"><Globe className="w-3 h-3" /><span>Webhook</span></label>
            <input type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl text-blue-600 font-bold" />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Time</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Admin</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Cmd</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase">Path & telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? filteredLogs.map((log, idx) => (
                <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${activeFilter ? 'bg-blue-50/10' : ''}`}>
                  <td className="px-4 py-4 text-[11px] font-mono text-blue-600 font-bold whitespace-nowrap">{log.time}</td>
                  <td className="px-4 py-4 text-[11px] font-black text-slate-800">{log.admin}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600 uppercase">{log.cmd}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className={`text-[10px] font-mono line-clamp-1 ${activeFilter ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{log.path}</div>
                      {log.after && <div className="text-[10px] bg-emerald-50 text-emerald-700 p-1.5 rounded border border-emerald-100 font-mono">+{log.after}</div>}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-40 text-center">
                    <Monitor className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">{activeFilter ? 'No matching logs for filter' : 'Telemetry Link Idle'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;