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
  ZapOff,
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

      // CORS BYPASS STRATEGY: 
      // Using text/plain prevents the browser from triggering a Preflight OPTIONS request.
      // This is the most effective way to talk to n8n without changing server headers.
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 
          'Content-Type': bypassCORS ? 'text/plain' : 'application/json',
        },
        body: JSON.stringify(payload),
        // no-cors mode can be used if we only care about sending, 
        // but for reading response we need 'cors' and a simple request (text/plain)
        mode: 'cors'
      };

      const response = await fetch(localConfig.webhookUrl, fetchOptions);

      if (!response.ok) throw new Error(`n8n Error: ${response.status} - ${response.statusText}`);
      
      const data = await response.json();
      const resultData = data.response?.result?.log?.entry || data.entry || data.result?.log?.entry || data;
      const entries = Array.isArray(resultData) ? resultData : (resultData && typeof resultData === 'object' ? [resultData] : []);

      if (entries.length === 0) throw new Error("Workflow executed but returned no logs.");

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
      if (err.name === 'TypeError' || err.message.includes('CORS')) {
        setError(`CORS Policy Block: The connection to ${new URL(localConfig.webhookUrl).hostname} was refused.`);
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
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Direct Agent Telemetry</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* CORS BYPASS TOGGLE */}
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
            <input type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl font-mono focus:ring-4 focus:ring-blue-50 outline-none" placeholder="10.1.244.68" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Key className="w-3 h-3" />
              <span>API Key</span>
            </label>
            <input type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>n8n Webhook</span>
            </label>
            <input type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl text-blue-600 font-bold focus:ring-4 focus:ring-blue-50 outline-none" placeholder="https://10.1.240.2/..." />
          </div>
        </div>

        {error && (
          <div className="mt-6 border-2 border-red-100 bg-red-50/50 rounded-2xl p-6 animate-in slide-in-from-top-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-100 rounded-xl text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-red-900 tracking-tight">CONNECTION INTERRUPTED</h3>
                <p className="text-sm text-red-700 mt-1 leading-relaxed">
                  The request to <b>{new URL(localConfig.webhookUrl || 'http://localhost').hostname}</b> failed. {!bypassCORS && "Try enabling 'Bypass CORS' above to use simple-request mode."}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
                    <h4 className="text-[10px] font-black text-red-800 uppercase mb-2">Technical Analysis</h4>
                    <p className="text-[11px] text-slate-500 mb-2">Browser security prevents cross-origin scripts from reading responses unless the server explicitly allows it.</p>
                    <code className="block bg-slate-900 text-orange-300 p-2 rounded text-[9px] font-mono whitespace-pre-wrap">
                      Error: {error}
                    </code>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-red-800 uppercase mb-1">Manual Verification</h4>
                      <p className="text-[11px] text-slate-500 mb-3">Copy this command and run it in your terminal to check if n8n is alive.</p>
                    </div>
                    <button onClick={copyCurl} className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Copy cURL Command</span>
                    </button>
                  </div>
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
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Command</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Result</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-4 text-[11px] font-mono text-blue-600 font-bold whitespace-nowrap">{log.time}</td>
                  <td className="px-4 py-4 text-[11px] font-black text-slate-800">{log.admin}</td>
                  <td className="px-4 py-4 text-[11px] font-bold text-slate-600">{log.cmd}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.result.toLowerCase().includes('suc') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.result}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono line-clamp-1">{log.path}</div>
                      {log.after && <div className="text-[10px] bg-emerald-50 text-emerald-700 p-1.5 rounded border border-emerald-100 font-mono">+{log.after}</div>}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-40 text-center">
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