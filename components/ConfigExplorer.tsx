
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Download, Database, List, ArrowRight, History, Search, Key, Code, X, FileText } from 'lucide-react';

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
  const [showSourceModal, setShowSourceModal] = useState(false);

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
    if (!ipAddress || !apiKey) {
      setExtractError("IP and API Key are required for extraction.");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
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
      setExtractError(err.message || "Failed to reach n8n agent");
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
          
          rules.push({ name, action, from, to, path: name });
        }
      }
      return rules;
    } catch (e) {
      return [];
    }
  }, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4 relative">
      {/* HEADER SECTION */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Analyze security rules extracted via n8n</span>
            </p>
          </div>
        </div>
        {selected && (
          <button 
            onClick={() => setShowSourceModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>View Source XML</span>
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* SIDEBAR: Snapshot List & Extraction Form */}
        <div className="w-72 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live XML Pull</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Device IP" 
                  value={ipAddress} 
                  onChange={(e) => setIpAddress(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono" 
                />
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="API Key" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" 
                />
              </div>
              <button 
                type="submit" 
                disabled={isExtracting} 
                className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all disabled:bg-slate-300"
              >
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExtracting ? 'Fetching...' : 'Extract'}</span>
              </button>
            </form>
            {extractError && <p className="mt-3 text-[9px] font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Snapshots</h4>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar">
              {configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer group ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[11px] truncate">{c.hostname}</p>
                    <FileText className={`w-3 h-3 ${selectedId === c.id ? 'text-blue-200' : 'text-slate-300'}`} />
                  </div>
                  <p className={`text-[8px] mt-1 uppercase tracking-widest font-mono ${selectedId === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.timestamp}</p>
                </div>
              ))}
              {configs.length === 0 && !isExtracting && <div className="py-20 text-center opacity-20 italic text-[10px] uppercase font-black">No snapshots</div>}
            </div>
          </div>
        </div>

        {/* MAIN PANEL: Full-width Policy List */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interactive Policy Rules</span>
                {selected && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-mono font-bold uppercase">{selected.ip}</span>}
             </div>
             <List className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
             {isExtracting ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                   <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parsing incoming configuration...</p>
                </div>
             ) : parsedRules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {parsedRules.map((rule, idx) => (
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
                          <span>View History</span>
                        </button>
                    </div>
                  ))}
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <List className="w-12 h-12 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-tighter">
                    {selected ? "No structured rules detected in XML" : "Select a snapshot to begin"}
                  </p>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* MODAL: Code View Overlay */}
      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-12">
          <div className="bg-slate-900 w-full max-w-5xl h-full max-h-[80vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div className="flex items-center space-x-3">
                <Code className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Configuration Source: {selected.hostname}</span>
              </div>
              <button 
                onClick={() => setShowSourceModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              <pre className="text-[11px] font-mono text-blue-100/70 whitespace-pre-wrap leading-relaxed selection:bg-blue-500/30">
                {selected.raw}
              </pre>
            </div>
            <div className="p-4 bg-black/20 border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setShowSourceModal(false)}
                className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-500 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigExplorer;
