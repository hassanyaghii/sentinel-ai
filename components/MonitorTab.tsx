import React, { useState } from 'react';
import { 
  Terminal, 
  Activity, 
  RefreshCw, 
  Monitor, 
  Hash,
  Server,
  Key,
  Globe
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
  const [jobId, setJobId] = useState('28');
  const [logs, setLogs] = useState<ConfigLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFetchLogs = async () => {
    setIsFetching(true);
    setError(null);
    try {
      if (!localConfig.webhookUrl) throw new Error("n8n Webhook URL is required.");
      
      const response = await fetch(localConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ipAddress: localConfig.ipAddress, 
          apiKey: localConfig.apiKey, 
          jobId: jobId,
          action: 'get_logs' 
        })
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      const data = await response.json();
      
      const xmlString = typeof data === 'string' ? data : data.raw || data.xml || JSON.stringify(data);
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      const parsedLogs: ConfigLog[] = [];
      let match;
      
      while ((match = entryRegex.exec(xmlString)) !== null) {
        const content = match[1];
        const getTag = (tag: string) => {
          const m = content.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
          return m ? m[1] : '';
        };
        parsedLogs.push({
          time: getTag('receive_time'),
          admin: getTag('admin'),
          host: getTag('host') || localConfig.ipAddress,
          client: getTag('client'),
          cmd: getTag('cmd'),
          result: getTag('result'),
          path: getTag('path'),
          before: getTag('before-change'),
          after: getTag('after-change'),
          sequence: getTag('seqno')
        });
      }
      setLogs(parsedLogs);
    } catch (err: any) {
      setError(err.message || "Failed to fetch logs.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4 animate-in fade-in duration-500">
      {/* Connectivity Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
            <Server className="w-3 h-3" />
            <span>Firewall IP</span>
          </label>
          <input 
            type="text" name="ipAddress" value={localConfig.ipAddress} onChange={handleConfigChange} placeholder="192.168.1.1"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
            <Key className="w-3 h-3" />
            <span>API Key</span>
          </label>
          <input 
            type="password" name="apiKey" value={localConfig.apiKey} onChange={handleConfigChange} placeholder="Enter Key"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
            <Globe className="w-3 h-3" />
            <span>n8n Webhook</span>
          </label>
          <input 
            type="text" name="webhookUrl" value={localConfig.webhookUrl} onChange={handleConfigChange} placeholder="https://..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none"
          />
        </div>
        <div className="flex space-x-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-1">
              <Hash className="w-3 h-3" />
              <span>Job ID</span>
            </label>
            <input 
              type="text" value={jobId} onChange={(e) => setJobId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-blue-200 bg-blue-50/30 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-blue-600"
            />
          </div>
          <button 
            onClick={handleFetchLogs}
            disabled={isFetching}
            className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center space-x-2 h-[38px] self-end shadow-lg shadow-slate-200"
          >
            {isFetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Professional Data Grid */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="min-w-max inline-block align-middle">
            <table className="min-w-full divide-y divide-slate-200 border-collapse">
              <thead className="bg-[#EBF5FB] sticky top-0 z-10">
                <tr className="divide-x divide-slate-300">
                  <th className="w-40 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Receive Time</th>
                  <th className="w-32 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Administrator</th>
                  <th className="w-36 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Host</th>
                  <th className="w-24 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Client</th>
                  <th className="w-24 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Command</th>
                  <th className="w-28 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Result</th>
                  <th className="w-72 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Configuration Path</th>
                  <th className="w-80 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Before Change</th>
                  <th className="w-80 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">After Change</th>
                  <th className="w-48 px-3 py-2.5 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Sequence Number</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-[11px] font-sans">
                {logs.length > 0 ? logs.map((log, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FDFF]'} divide-x divide-slate-100 hover:bg-blue-50/50 transition-colors`}>
                    <td className="px-3 py-2 text-blue-600 font-medium underline cursor-pointer">{log.time}</td>
                    <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.admin}</td>
                    <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.host}</td>
                    <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.client}</td>
                    <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.cmd}</td>
                    <td className={`px-3 py-2 font-medium ${log.result.toLowerCase() === 'succeeded' || log.result.toLowerCase() === 'submitted' ? 'text-blue-600 underline' : 'text-red-600'}`}>
                      {log.result}
                    </td>
                    <td className="px-3 py-2 text-slate-600 leading-tight font-mono text-[10px]">
                      <div className="max-h-20 overflow-y-auto custom-scrollbar whitespace-pre-wrap py-1">{log.path}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 leading-tight font-mono text-[10px]">
                      <div className="max-h-20 overflow-y-auto custom-scrollbar whitespace-pre-wrap py-1">{log.before}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 leading-tight font-mono text-[10px]">
                      <div className="max-h-20 overflow-y-auto custom-scrollbar whitespace-pre-wrap py-1">{log.after}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{log.sequence}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-32 text-center text-slate-300">
                      <div className="flex flex-col items-center">
                        <Monitor className="w-16 h-16 opacity-10 mb-4" />
                        <h4 className="text-lg font-bold text-slate-400 uppercase tracking-[0.2em]">Console Idle</h4>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-medium">Verify credentials above and click Refresh to start monitoring</p>
                        {error && <p className="mt-4 text-red-500 font-bold bg-red-50 px-4 py-2 rounded-xl border border-red-100 text-[10px]">{error}</p>}
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