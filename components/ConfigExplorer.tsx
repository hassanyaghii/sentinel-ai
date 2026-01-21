
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Download, Database, List, ArrowRight, History, Search } from 'lucide-react';

const CONFIG_API = "/api/config";

interface SavedConfig {
  id: string;
  timestamp: string;
  hostname: string;
  ip: string;
  raw: string;
}

interface InteractiveRule {
  name: string;
  action: string;
  from: string;
  to: string;
  path: string;
}

interface ConfigExplorerProps {
  onJumpToLogs?: (path: string) => void;
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onJumpToLogs }) => {
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
    if (!ipAddress) return;

    setIsExtracting(true);
    setExtractError(null);
    // Optional: deselect current to focus on the new fetch
    setSelectedId(null);

    try {
      console.log("Triggering Config XML Extraction via n8n Proxy...");
      const response = await fetch(CONFIG_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "n8n Extraction failed");
      }

      const data = await response.json();
      console.log("Config extracted. Data:", data);
      
      // Handle array or object response from n8n
      const result = Array.isArray(data) ? data[0] : data;
      
      const newEntry: SavedConfig = {
        id: 'id-' + Date.now(),
        timestamp: new Date().toLocaleString(),
        hostname: result.hostname || ipAddress || 'Device',
        ip: ipAddress,
        raw: result.firewallConfig || result.xml || JSON.stringify(result, null, 2)
      };
      
      const updated = [newEntry, ...configs];
      setConfigs(updated);
      localStorage.setItem('sentinel_configs', JSON.stringify(updated));
      setSelectedId(newEntry.id);
    } catch (err: any) {
      console.error("Extraction failed:", err);
      setExtractError(err.message || "Failed to reach n8n agent via proxy");
    } finally {
      setIsExtracting(false);
    }
  };

  const selected = configs.find(c => c.id === selectedId);

  const parsedRules = useMemo(() => {
    if (!selected || !selected.raw || !selected.raw.includes('<rules>')) return [];
    try {
      const rules: InteractiveRule[] = [];
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(selected.raw, "text/xml");
      const entries = xmlDoc.getElementsByTagName("entry");

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const name = entry.getAttribute("name");
        if (!name) continue;

        const parent = entry.parentElement;
        if (parent && parent.tagName === "rules") {
          const action = entry.getElementsByTagName("action")[0]?.textContent || "allow";
          const from = entry.getElementsByTagName("from")[0]?.getElementsByTagName("member")[0]?.textContent || "any";
          const to = entry.getElementsByTagName("to")[0]?.getElementsByTagName("member")[0]?.textContent || "any";
          
          rules.push({
            name,
            action,
            from,
            to,
            path: name
          });
        }
      }
      return rules;
    } catch (e) {
      console.error("XML Parsing error:", e);
      return [];
    }
  }, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Click any rule to see its Change History (from MySQL)</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        <div className="w-72 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live XML Pull via n8n</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <input type="text" placeholder="Device IP Address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl" />
              <button type="submit" disabled={isExtracting} className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95">
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExtracting ? 'Fetching...' : 'Extract Config'}</span>
              </button>
            </form>
            {extractError && <p className="mt-3 text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Snapshot History</h4>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar">
              {configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="font-bold text-[11px] truncate">{c.hostname}</p>
                  <p className="text-[8px] opacity-70 mt-1 uppercase tracking-widest font-mono">{c.timestamp}</p>
                </div>
              ))}
              {configs.length === 0 && !isExtracting && <div className="py-20 text-center opacity-20 italic text-[10px] uppercase font-black">No snapshots</div>}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interactive Policy Rules</span>
                <List className="w-4 h-4 text-slate-300" />
             </div>
             <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                {isExtracting ? (
                   <div className="h-full flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parsing incoming XML...</p>
                   </div>
                ) : parsedRules.length > 0 ? parsedRules.map((rule, idx) => (
                   <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start mb-2">
                         <h5 className="font-black text-slate-800 text-xs truncate pr-4 uppercase">{rule.name}</h5>
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rule.action}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-4">
                         <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{rule.from}</span>
                         <ArrowRight className="w-3 h-3 text-slate-300" />
                         <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{rule.to}</span>
                      </div>
                      <button 
                        onClick={() => onJumpToLogs?.(rule.name)}
                        className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 transition-all shadow-lg hover:bg-black"
                      >
                         <History className="w-3 h-3 text-blue-400" />
                         <span>View Change History</span>
                      </button>
                   </div>
                )) : (
                   <div className="h-full flex flex-col items-center justify-center opacity-20"><List className="w-12 h-12 mb-2" /><p className="text-[10px] font-black uppercase tracking-tighter">No structured rules detected</p></div>
                )}
             </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
             <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Configuration XML Source</span>
                <Search className="w-4 h-4 text-blue-900" />
             </div>
             <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
                <pre className="text-[10px] font-mono text-blue-100/60 whitespace-pre-wrap leading-relaxed">
                  {isExtracting ? "/* WAITING FOR AGENT DATA... */" : selected?.raw || 'Select a snapshot or trigger "Extract Config" to pull live XML from the firewall.'}
                </pre>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;
