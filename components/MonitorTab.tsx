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
  Copy
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

      const response = await fetch(localConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`n8n Error: ${response.status} - ${response.statusText}`);
      
      const data = await response.json();
      
      // Navigate common n8n/Palo result paths
      const resultData = data.response?.result?.log?.entry || data.entry || data.result?.log?.entry || [];
      const entries = Array.isArray(resultData) ? resultData : [resultData];

      if (entries.length === 0 || (entries.length === 1 && !entries[0])) {
        throw new Error("Workflow executed but returned no log entries.");
      }

      const parsedLogs: ConfigLog[] = entries.map((entry: any) => ({
        time: entry.receive_time || 'N/A',
        admin: entry.admin || 'N/A',
        host: entry.host || localConfig.ipAddress,
        client: entry.client || 'N/A',
        cmd: entry.cmd || 'N/A',
        result: entry.result || 'N/A',
        path: entry.path || '',
        before: entry['before-change'] || '',
        after: entry['after-change'] || '',
        sequence: entry.seqno || ''
      }));

      setLogs(parsedLogs);
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError("CORS/Network Error: The n8n server rejected the request or is unreachable. Ensure 'Access-Control-Allow-Origin' is configured in n8n or use a browser extension to bypass CORS for local testing.");
      } else {
        setError(err.message || "Failed to communicate with n8n workflow.");
      }
      setShowDebug(true);
    } finally {
      setIsFetching(false);
    }
  };

  const copyDebugPayload = () => {
    const payload = JSON.stringify({ 
      fw_ip: localConfig.ipAddress, 
      api_key: localConfig.apiKey,
      action: 'get_logs'
    }, null, 2);
    navigator.clipboard.writeText(`curl -X POST "${localConfig.webhookUrl}" -H "Content-Type: application/json" -d '${payload}'`);
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-slate-900 rounded-xl text-white shadow-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">LOG VIEWER</h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">n8n Agent Integration</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {error && (
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center space-x-2"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showDebug ? 'Hide Debug' : 'Debug Connection'}</span>
              </button>
            )}
            <button 
              onClick={handleFetchLogs}
              disabled={isFetching}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shadow-lg ${
                isFetching ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isFetching ? 'Processing...' : 'Fetch Logs'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Server className="w-3 h-3" />
              <span>Firewall Host</span>
            </label>
            <input 
              type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} placeholder="10.1.244.68"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Key className="w-3 h-3" />
              <span>API Key</span>
            </label>
            <input 
              type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} placeholder="LUFRPT1..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>Webhook Endpoint</span>
            </label>
            <input 
              type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} placeholder="https://10.1.240.2/webhook/..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none"
            />
          </div>
        </div>

        {showDebug && error && (
          <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800 animate-in fade-in duration-300">
             <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Connection Debugger</span>
               <button onClick={copyDebugPayload} className="text-white/50 hover:text-white flex items-center space-x-1 text-[10px] font-bold">
                 <Copy className="w-3 h-3" />
                 <span>Copy as cURL</span>
               </button>
             </div>
             <p className="text-xs text-red-400 mb-3 font-bold">{error}</p>
             <div className="bg-black/40 p-3 rounded font-mono text-[10px] text-blue-200/80">
               POST {localConfig.webhookUrl}<br/>
               Content-Type: application/json<br/><br/>
               {JSON.stringify({ fw_ip: localConfig.ipAddress, api_key: '***', action: 'get_logs' }, null, 2)}
             </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="min-w-max inline-block align-middle">
            <table className="min-w-full divide-y divide-slate-200 border-collapse">
              <thead className="bg-[#EBF5FB] sticky top-0 z-10">
                <tr className="divide-x divide-slate-300">
                  <th className="w-44 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Receive Time</th>
                  <th className="w-32 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Admin</th>
                  <th className="w-36 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Host</th>
                  <th className="w-24 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Command</th>
                  <th className="w-28 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Result</th>
                  <th className="w-96 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Configuration Path</th>
                  <th className="w-80 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Before</th>
                  <th className="w-80 px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">After</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-[11px]">
                {logs.length > 0 ? logs.map((log, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FDFF]'} divide-x divide-slate-100 hover:bg-blue-50/50 transition-colors`}>
                    <td className="px-4 py-3 text-blue-600 font-bold font-mono">{log.time}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{log.admin}</td>
                    <td className="px-4 py-3 text-slate-500">{log.host}</td>
                    <td className="px-4 py-3 text-blue-600 font-bold">{log.cmd}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        log.result.toLowerCase() === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] text-slate-600 whitespace-pre-wrap">{log.path}</div>
                    </td>
                    <td className="px-4 py-3 text-red-600/70">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] whitespace-pre-wrap">{log.before}</div>
                    </td>
                    <td className="px-4 py-3 text-emerald-600/70">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] whitespace-pre-wrap">{log.after}</div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-40 text-center text-slate-300">
                      <div className="flex flex-col items-center">
                        <Monitor className="w-16 h-16 opacity-10 mb-4" />
                        <h4 className="text-lg font-bold text-slate-400 uppercase tracking-[0.2em]">Awaiting Input</h4>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-medium">Click "Fetch Logs" to run the auditor workflow</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitorTab;