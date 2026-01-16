import React, { useState } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Monitor, 
  Server, 
  Key, 
  Globe,
  AlertCircle,
  Terminal,
  Copy,
  ShieldAlert,
  Zap,
  Lock,
  Unlock
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
}

const MonitorTab: React.FC<MonitorTabProps> = ({ config: initialConfig }) => {
  const [localConfig, setLocalConfig] = useState<AuditConfig>(initialConfig);
  const [logs, setLogs] = useState<ConfigLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [bypassCORS, setBypassCORS] = useState(false);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFetchLogs = async () => {
    setIsFetching(true);
    setError(null);
    try {
      if (!localConfig.webhookUrl) throw new Error("n8n Webhook URL is required.");
      
      const payload = { 
        fw_ip: localConfig.ipAddress, 
        api_key: localConfig.apiKey,
        action: 'get_logs'
      };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 
          'Content-Type': bypassCORS ? 'text/plain' : 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'cors'
      };

      const response = await fetch(localConfig.webhookUrl, fetchOptions);

      if (!response.ok) throw new Error(`n8n Error: ${response.status} - ${response.statusText}`);
      
      const rawData = await response.json();
      
      // Navigate the specific nested structure from the provided JSON:
      // response.result.log.logs.entry (Inside an array of responses)
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
      const resultData = data.response?.result?.log?.logs?.entry || 
                         data.response?.result?.log?.entry || 
                         data.entry || 
                         data;
                         
      const entries = Array.isArray(resultData) ? resultData : (resultData && typeof resultData === 'object' ? [resultData] : []);

      if (entries.length === 0) throw new Error("No entries found in the response structure.");

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
      if (err.name === 'TypeError' || err.message.includes('CORS')) {
        setError(`CORS Policy Block: The connection to the n8n host was refused.`);
      } else {
        setError(err.message || "Connection failed.");
      }
      setShowDebug(true);
    } finally {
      setIsFetching(false);
    }
  };

  const copyCurl = () => {
    const payload = JSON.stringify({ fw_ip: localConfig.ipAddress, api_key: localConfig.apiKey, action: 'get_logs' });
    const command = `curl -k -X POST "${localConfig.webhookUrl}" -H "Content-Type: application/json" -d '${payload}'`;
    navigator.clipboard.writeText(command);
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl text-white shadow-lg transition-colors duration-500 ${bypassCORS ? 'bg-orange-500' : 'bg-slate-900'}`}>
              {bypassCORS ? <Zap className="w-6 h-6 animate-pulse" /> : <Activity className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Audit Monitor</h2>
                {bypassCORS && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-black rounded-full uppercase tracking-widest animate-pulse">Bypass Active</span>}
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Live Config Telemetry</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setBypassCORS(!bypassCORS)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                bypassCORS 
                ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-inner' 
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'
              }`}
            >
              {bypassCORS ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-widest">Bypass CORS</span>
            </button>

            <button 
              onClick={handleFetchLogs}
              disabled={isFetching}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shadow-lg ${
                isFetching ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isFetching ? 'Syncing...' : 'Fetch Logs'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Server className="w-3 h-3" />
              <span>Firewall Host</span>
            </label>
            <input type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl font-mono focus:ring-4 focus:ring-blue-50 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Key className="w-3 h-3" />
              <span>API Key</span>
            </label>
            <input type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>n8n Webhook</span>
            </label>
            <input type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl text-blue-600 font-bold focus:ring-4 focus:ring-blue-50 outline-none" />
          </div>
        </div>

        {error && (
          <div className="mt-6 border-2 border-red-100 bg-red-50/50 rounded-2xl p-6">
            <div className="flex items-start space-x-4">
              <ShieldAlert className="w-6 h-6 text-red-600" />
              <div className="flex-1">
                <h3 className="text-lg font-black text-red-900">SYNC ERROR</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-4 flex space-x-3">
                   <button onClick={copyCurl} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center space-x-2">
                      <Terminal className="w-3 h-3" />
                      <span>Copy Manual Test</span>
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cmd</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Path</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Before</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-4 text-[11px] font-mono text-blue-600 font-bold whitespace-nowrap">{log.time}</td>
                  <td className="px-4 py-4 text-[11px] font-black text-slate-800">{log.admin}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600 uppercase">{log.cmd}</span>
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <div className="text-[10px] text-slate-500 font-mono truncate" title={log.path}>{log.path}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-[10px] text-red-500 font-mono max-h-12 overflow-y-auto">{log.before}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-[10px] text-emerald-600 font-mono max-h-12 overflow-y-auto font-bold">{log.after}</div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-40 text-center">
                    <Monitor className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">System Link Idle</p>
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