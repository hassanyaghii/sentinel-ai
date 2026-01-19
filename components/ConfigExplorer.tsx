
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Download, Activity, Server, Key, ShieldCheck, Database } from 'lucide-react';

const CONFIG_API = "/api/config";

interface SavedConfig {
  id: string;
  timestamp: string;
  hostname: string;
  ip: string;
  raw: string;
}

const ConfigExplorer: React.FC = () => {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sentinel_configs');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConfigs(parsed);
      if (parsed.length > 0 && !selectedId) setSelectedId(parsed[0].id);
    }
  }, []);

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch(CONFIG_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey, action: 'get_config' })
      });
      if (!response.ok) throw new Error(`Agent Error: ${response.status}`);
      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      
      const newEntry: SavedConfig = {
        id: 'id-' + Date.now(),
        timestamp: new Date().toLocaleString(),
        hostname: result.hostname || ipAddress,
        ip: ipAddress,
        raw: result.firewallConfig || JSON.stringify(result)
      };
      
      const updated = [newEntry, ...configs];
      setConfigs(updated);
      localStorage.setItem('sentinel_configs', JSON.stringify(updated));
      setSelectedId(newEntry.id);
    } catch (err: any) {
      setExtractError(err.message || "Failed to reach backend");
    } finally {
      setIsExtracting(false);
    }
  };

  const selected = configs.find(c => c.id === selectedId);

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Verified Local Backend Connection</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trigger n8n Fetch</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <input type="text" placeholder="Firewall IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none" />
              <input type="password" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none" />
              <button type="submit" disabled={isExtracting} className="w-full py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2">
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Fetch via Agent</span>
              </button>
            </form>
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Saved Snapshots</h4>
            <div className="flex-1 overflow-auto space-y-2">
              {configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="font-bold text-[11px] truncate">{c.hostname}</p>
                  <p className="text-[8px] opacity-70 mt-1 uppercase tracking-widest">{c.timestamp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {selected ? (
            <pre className="p-6 text-[11px] font-mono text-slate-600 bg-slate-50 h-full overflow-auto custom-scrollbar">
              {selected.raw}
            </pre>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
               <Database className="w-12 h-12 mb-3 opacity-20" />
               <p className="text-[10px] font-black uppercase tracking-widest">Select a snapshot to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;
