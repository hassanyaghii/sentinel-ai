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
  Info
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

      // Note: Browser-side CORS is a server-side configuration in n8n.
      // If n8n is on a different subnet/IP (10.1.240.2 vs 10.1.244.70), it MUST allow the origin.
      const response = await fetch(localConfig.webhookUrl, {
        method: 'POST',
        mode: 'cors', // Explicitly request CORS
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`n8n Error: ${response.status} - ${response.statusText}`);
      
      const data = await response.json();
      
      // Navigate common n8n/Palo result paths based on the provided workflow
      // Your workflow uses XML to JSON which typically outputs response.result.log.entry
      const resultData = data.response?.result?.log?.entry || data.entry || data.result?.log?.entry || data;
      const entries = Array.isArray(resultData) ? resultData : (resultData && typeof resultData === 'object' ? [resultData] : []);

      if (entries.length === 0) {
        throw new Error("Workflow returned an empty response. Check if logs exist for the query in n8n.");
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
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        setError("CORS/Network Error: The browser blocked the request to n8n (10.1.240.2).");
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
    const curl = `curl -X POST "${localConfig.webhookUrl}" -H "Content-Type: application/json" -d '${payload}'`;
    navigator.clipboard.writeText(curl);
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
              <h2 className="text-xl font-black text-slate-900 tracking-tight">AUDIT LOG MONITOR</h2>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Palo Alto Config Auditor</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleFetchLogs}
              disabled={isFetching}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shadow-lg ${
                isFetching ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isFetching ? 'Running Workflow...' : 'Fetch Logs'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Server className="w-3 h-3" />
              <span>Firewall IP (fw_ip)</span>
            </label>
            <input 
              type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} placeholder="10.1.244.68"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Key className="w-3 h-3" />
              <span>API Key (api_key)</span>
            </label>
            <input 
              type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} placeholder="LUFRPT1..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>n8n Webhook URL</span>
            </label>
            <input 
              type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} placeholder="https://10.1.240.2/webhook/..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none text-blue-600 font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl animate-in slide-in-from-top-2">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Security Block Detected (CORS)</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  The browser blocked the connection to your n8n server at <b>{new URL(localConfig.webhookUrl || 'http://localhost').host}</b>.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button 
                    onClick={() => setShowDebug(!showDebug)}
                    className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-[10px] font-black uppercase hover:bg-red-200 transition-colors"
                  >
                    {showDebug ? 'Hide Technical Details' : 'View Debug Info'}
                  </button>
                  <a 
                    href="https://docs.n8n.io/hosting/configuration/environment-variables/#webhooks" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-black uppercase flex items-center space-x-1"
                  >
                    <span>n8n CORS Fix</span>
                    <Info className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {showDebug && (
              <div className="mt-4 bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-[10px] text-blue-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-400 font-bold uppercase">Manual Test Payload</span>
                  <button onClick={copyDebugPayload} className="flex items-center space-x-1 hover:text-white transition-colors">
                    <Copy className="w-3 h-3" />
                    <span>Copy cURL</span>
                  </button>
                </div>
                <div className="bg-black/40 p-3 rounded overflow-x-auto">
                  curl -X POST "{localConfig.webhookUrl}" \<br/>
                  -H "Content-Type: application/json" \<br/>
                  -d '{JSON.stringify({ fw_ip: localConfig.ipAddress, api_key: "...", action: "get_logs" }, null, 2)}'
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="min-w-max inline-block align-middle">
            <table className="min-w-full divide-y divide-slate-200 border-collapse">
              <thead className="bg-[#EBF5FB] sticky top-0 z-10">
                <tr className="divide-x divide-slate-300">
                  <th className="w-44 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Receive Time</th>
                  <th className="w-32 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Admin</th>
                  <th className="w-32 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Host</th>
                  <th className="w-24 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Command</th>
                  <th className="w-24 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Result</th>
                  <th className="w-96 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Palo Alto Config Path</th>
                  <th className="w-80 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Diff (Before)</th>
                  <th className="w-80 px-4 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest">Diff (After)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-[11px]">
                {logs.length > 0 ? logs.map((log, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FDFF]'} divide-x divide-slate-100 hover:bg-blue-50/50 transition-colors`}>
                    <td className="px-4 py-4 text-blue-600 font-bold font-mono">{log.time}</td>
                    <td className="px-4 py-4 font-bold text-slate-800">{log.admin}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono">{log.host}</td>
                    <td className="px-4 py-4 font-black text-blue-600/80">{log.cmd}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        log.result.toLowerCase() === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] text-slate-600 leading-relaxed">{log.path}</div>
                    </td>
                    <td className="px-4 py-4 text-red-600/80 italic">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] whitespace-pre-wrap">{log.before}</div>
                    </td>
                    <td className="px-4 py-4 text-emerald-600/80 font-bold">
                      <div className="max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] whitespace-pre-wrap">{log.after}</div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-40 text-center text-slate-300">
                      <div className="flex flex-col items-center">
                        <Monitor className="w-20 h-20 opacity-5 mb-4" />
                        <h4 className="text-xl font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Workflow</h4>
                        <p className="text-xs text-slate-400 mt-2 uppercase font-black tracking-widest opacity-60">Ready to audit ruleset logs via n8n agent</p>
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