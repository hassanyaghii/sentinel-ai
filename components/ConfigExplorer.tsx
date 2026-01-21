
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Database, List, ArrowRight, History, Search, Code, X, FileText, AlertCircle } from 'lucide-react';

const SNAPSHOTS_API = "/api/config-snapshots";

interface SavedConfig {
  id: string | number;
  timestamp: string;
  hostname: string;
  ip_address: string;
  raw_xml: string;
}

interface InteractiveRule {
  name: string;
  action: string;
  from: string;
  to: string;
  source: string;
  dest: string;
}

interface ConfigExplorerProps {
  onJumpToLogs?: (path: string) => void;
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onJumpToLogs }) => {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);

  // Fetch snapshots from MySQL database
  const fetchSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(SNAPSHOTS_API);
      if (!response.ok) throw new Error("Failed to fetch snapshots from database");
      const data = await response.json();
      
      // Map database fields to our interface
      const mappedData = data.map((item: any) => ({
        id: item.id,
        timestamp: new Date(item.created_at || Date.now()).toLocaleString(),
        hostname: item.hostname || 'Unknown Device',
        ip_address: item.ip_address || '0.0.0.0',
        raw_xml: item.raw_xml || ''
      }));

      setConfigs(mappedData);
      if (mappedData.length > 0 && selectedId === null) {
        setSelectedId(mappedData[0].id);
      }
    } catch (err: any) {
      console.error("Database fetch error:", err);
      setError("Could not load snapshots from MySQL. Ensure server.js is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const selected = configs.find(c => c.id === selectedId);

  const parsedRules = useMemo(() => {
    if (!selected || !selected.raw_xml) return [];
    try {
      const parser = new DOMParser();
      // The database content might have DOCTYPE or response wrappers
      const xmlDoc = parser.parseFromString(selected.raw_xml, "text/xml");
      
      // Deep traverse Palo Alto XML: response -> result -> entry -> rulebase -> security -> rules -> entry
      const ruleEntries = xmlDoc.querySelectorAll("rulebase > security > rules > entry");
      
      const rules: InteractiveRule[] = [];
      
      ruleEntries.forEach((entry) => {
        const name = entry.getAttribute("name") || "Unnamed Rule";
        
        const getMembers = (tagName: string) => {
          const tag = entry.querySelector(tagName);
          if (!tag) return "any";
          const members = Array.from(tag.querySelectorAll("member")).map(m => m.textContent);
          return members.length > 0 ? members.join(", ") : "any";
        };

        const action = entry.querySelector("action")?.textContent || "allow";
        const from = getMembers("from");
        const to = getMembers("to");
        const source = getMembers("source");
        const dest = getMembers("destination");

        rules.push({
          name,
          action,
          from,
          to,
          source,
          dest
        });
      });

      return rules;
    } catch (e) {
      console.error("XML Parsing error:", e);
      return [];
    }
  }, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4 relative">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Viewing Configuration Snapshots from Database</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchSnapshots}
            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
            title="Refresh from DB"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {selected && (
            <button 
              onClick={() => setShowSourceModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Source XML</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* SIDEBAR: DB Snapshots */}
        <div className="w-72 flex flex-col space-y-4 shrink-0">
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Database Records</h4>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar">
              {configs.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedId(c.id)} 
                  className={`p-3 rounded-xl border transition-all cursor-pointer group ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[11px] truncate">{c.hostname}</p>
                    <FileText className={`w-3 h-3 ${selectedId === c.id ? 'text-blue-200' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-[8px] uppercase tracking-widest font-mono ${selectedId === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.ip_address}</p>
                    <p className={`text-[7px] font-bold ${selectedId === c.id ? 'text-blue-200' : 'text-slate-300'}`}>{c.timestamp.split(',')[0]}</p>
                  </div>
                </div>
              ))}
              {configs.length === 0 && !isLoading && (
                <div className="py-20 text-center opacity-20">
                  <Database className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase">No records found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN PANEL */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Policies</span>
                {selected && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-mono font-bold uppercase">ID: {selected.id}</span>}
             </div>
             <List className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
             {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                   <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading from database...</p>
                </div>
             ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 space-y-2">
                   <AlertCircle className="w-10 h-10" />
                   <p className="text-xs font-bold uppercase">{error}</p>
                </div>
             ) : parsedRules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {parsedRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-black text-slate-800 text-[11px] truncate pr-4 uppercase" title={rule.name}>{rule.name}</h5>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rule.action}</span>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Source</span>
                             <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 truncate">
                                <span className="text-blue-500">[{rule.from}]</span>
                                <span className="text-slate-400">→</span>
                                <span>{rule.source}</span>
                             </div>
                          </div>
                          <div className="flex items-center justify-center">
                             <ArrowRight className="w-3 h-3 text-slate-200" />
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Destination</span>
                             <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 truncate">
                                <span className="text-green-500">[{rule.to}]</span>
                                <span className="text-slate-400">→</span>
                                <span>{rule.dest}</span>
                             </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => onJumpToLogs?.(rule.name)}
                          className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 transition-all shadow-lg hover:bg-black"
                        >
                          <History className="w-3 h-3 text-blue-400" />
                          <span>View Logs</span>
                        </button>
                    </div>
                  ))}
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <List className="w-12 h-12 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-tighter">
                    {selected ? "No security rules detected in this snapshot" : "Select a record to begin"}
                  </p>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* MODAL: Code View Overlay */}
      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 md:p-12">
          <div className="bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-blue-500/10 rounded-lg"><Code className="w-4 h-4 text-blue-400" /></div>
                <div>
                  <span className="text-xs font-black text-white uppercase tracking-widest block">Raw Configuration Source</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">{selected.hostname} — {selected.timestamp}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowSourceModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800/50 to-slate-900">
              <pre className="text-[11px] font-mono text-blue-100/60 whitespace-pre-wrap leading-relaxed selection:bg-blue-500/30">
                {selected.raw_xml}
              </pre>
            </div>
            <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setShowSourceModal(false)}
                className="px-8 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-500 transition-all active:scale-95"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigExplorer;
