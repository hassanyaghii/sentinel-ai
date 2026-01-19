
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Download, Database, List, Search, ArrowRight, History } from 'lucide-react';

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
    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch(CONFIG_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey, action: 'get_config' })
      });
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

  // Simple XML Parser for PAN-OS Rules to make them clickable
  const parsedRules = useMemo(() => {
    if (!selected || !selected.raw.includes('<rules>')) return [];
    const rules: InteractiveRule[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(selected.raw, "text/xml");
    const entries = xmlDoc.getElementsByTagName("entry");

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const name = entry.getAttribute("name");
      if (!name) continue;

      // Only pick items that look like security rules (in rulebase/security/rules)
      const parent = entry.parentElement;
      if (parent && parent.tagName === "rules") {
        const action = entry.getElementsByTagName("action")[0]?.textContent || "unknown";
        const from = entry.getElementsByTagName("from")[0]?.getElementsByTagName("member")[0]?.textContent || "any";
        const to = entry.getElementsByTagName("to")[0]?.getElementsByTagName("member")[0]?.textContent || "any";
        
        rules.push({
          name,
          action,
          from,
          to,
          // This path format matches how PAN-OS usually reports it in logs
          path: `rulebase security rules ${name}`
        });
      }
    }
    return rules;
  }, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Direct Link to DB Telemetry</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        <div className="w-80 flex flex-col space-y-4 shrink-0 overflow-hidden">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Snapshot Trigger</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <input type="text" placeholder="Device IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl" />
              <button type="submit" disabled={isExtracting} className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2">
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Fetch via Agent</span>
              </button>
            </form>
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Saved Files</h4>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar">
              {configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="font-bold text-[11px] truncate">{c.hostname}</p>
                  <p className="text-[8px] opacity-70 mt-1 uppercase">{c.timestamp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interactive Policy Objects</span>
                <List className="w-4 h-4 text-slate-300" />
             </div>
             <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                {parsedRules.length > 0 ? parsedRules.map((rule, idx) => (
                   <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/20 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                         <h5 className="font-black text-slate-800 text-xs truncate max-w-[150px]">{rule.name}</h5>
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rule.action}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-4">
                         <span>{rule.from}</span>
                         <ArrowRight className="w-3 h-3" />
                         <span>{rule.to}</span>
                      </div>
                      <button 
                        onClick={() => onJumpToLogs?.(rule.name)}
                        className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                      >
                         <History className="w-3 h-3 text-blue-400" />
                         <span>Audit Trail (DB)</span>
                      </button>
                   </div>
                )) : (
                   <div className="h-full flex flex-col items-center justify-center opacity-20"><List className="w-12 h-12 mb-2" /><p className="text-[10px] font-black uppercase">No rules detected</p></div>
                )}
             </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
             <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Raw PAN-OS XML</span>
                <Database className="w-4 h-4 text-blue-900" />
             </div>
             <div className="flex-1 overflow-auto p-4">
                <pre className="text-[10px] font-mono text-blue-100/70 whitespace-pre-wrap leading-relaxed">
                  {selected?.raw}
                </pre>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;
