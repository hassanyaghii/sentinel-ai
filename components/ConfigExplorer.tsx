
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, RefreshCw, Database, List, ArrowRight, History, 
  Code, X, FileText, AlertCircle, ShieldCheck, ShieldAlert, 
  Download, Key, Search, Globe, ChevronRight, Copy, Diff, Columns, Layers, Plus, Trash, Edit3
} from 'lucide-react';
import { AuditConfig } from '../types';

const SNAPSHOTS_API = "/api/config-snapshots";
const EXTRACTION_API = "/api/config"; 

interface SavedSnapshot {
  id: number;
  ip_address: string;
  hostname: string;
  raw_xml: string;
  created_at: string;
}

interface InteractiveRule {
  name: string;
  action: string;
  from: string;
  to: string;
  source: string;
  dest: string;
  application: string;
  service: string;
}

interface ComparedRule extends InteractiveRule {
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: Partial<InteractiveRule>;
}

interface ConfigExplorerProps {
  onJumpToLogs?: (path: string) => void;
  sharedConfig: AuditConfig;
  onConfigChange: (config: AuditConfig) => void;
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onJumpToLogs, sharedConfig, onConfigChange }) => {
  const [configs, setConfigs] = useState<SavedSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);

  const fetchSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(SNAPSHOTS_API);
      if (!response.ok) throw new Error("Failed to fetch snapshots from MySQL");
      const data = await response.json();
      setConfigs(data);
      if (data.length > 0 && selectedId === null) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      setError("Could not load snapshots. Check server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharedConfig.ipAddress || !sharedConfig.apiKey) {
      setError("Firewall IP and API Key are required.");
      return;
    }
    setIsExtracting(true);
    setError(null);
    try {
      const response = await fetch(EXTRACTION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: sharedConfig.ipAddress, apiKey: sharedConfig.apiKey, vendor: 'paloalto' })
      });
      if (!response.ok) throw new Error("Extraction failed.");
      setTimeout(() => {
        fetchSnapshots();
        setIsExtracting(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const parseRules = (snapshot: SavedSnapshot | undefined): Map<string, InteractiveRule> => {
    const ruleMap = new Map<string, InteractiveRule>();
    if (!snapshot || !snapshot.raw_xml) return ruleMap;
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(snapshot.raw_xml, "text/xml");
      const ruleEntries = xmlDoc.querySelectorAll("rules > entry, security > rules > entry, entry > rules > entry");
      
      ruleEntries.forEach((entry) => {
        const name = entry.getAttribute("name") || "Unnamed Rule";
        const getMembers = (tagName: string) => {
          const tag = entry.querySelector(tagName);
          if (!tag) return "any";
          const members = Array.from(tag.querySelectorAll("member")).map(m => m.textContent?.trim());
          return members.length > 0 ? members.join(", ") : "any";
        };
        const actionTag = entry.querySelector("action");
        if (!actionTag) return;

        ruleMap.set(name, {
          name,
          action: actionTag.textContent?.toLowerCase() || "allow",
          from: getMembers("from"),
          to: getMembers("to"),
          source: getMembers("source"),
          dest: getMembers("destination"),
          application: getMembers("application"),
          service: getMembers("service")
        });
      });
    } catch (e) {
      console.error("Rule parsing error:", e);
    }
    return ruleMap;
  };

  const selected = configs.find(c => c.id === selectedId);
  const compareWith = configs.find(c => c.id === compareId);

  const comparedResults = useMemo(() => {
    if (!isCompareMode || !selected || !compareWith) return [];
    
    const rulesA = parseRules(selected);
    const rulesB = parseRules(compareWith);
    const result: ComparedRule[] = [];
    const allNames = new Set([...Array.from(rulesA.keys()), ...Array.from(rulesB.keys())]);

    allNames.forEach(name => {
      const ruleA = rulesA.get(name);
      const ruleB = rulesB.get(name);

      if (!ruleA && ruleB) {
        result.push({ ...ruleB, status: 'added' });
      } else if (ruleA && !ruleB) {
        result.push({ ...ruleA, status: 'removed' });
      } else if (ruleA && ruleB) {
        const isModified = JSON.stringify(ruleA) !== JSON.stringify(ruleB);
        result.push({ 
          ...ruleB, 
          status: isModified ? 'modified' : 'unchanged', 
          oldValue: isModified ? ruleA : undefined 
        });
      }
    });

    // Sort to show changes first
    return result.sort((a, b) => {
      if (a.status === b.status) return a.name.localeCompare(b.name);
      const order = { added: 0, removed: 1, modified: 2, unchanged: 3 };
      return order[a.status] - order[b.status];
    });
  }, [isCompareMode, selected, compareWith]);

  const baseRules = useMemo(() => {
    const map = parseRules(selected);
    return Array.from(map.values());
  }, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4 relative">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Globe className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Policy Explorer</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter flex items-center gap-1">
              <Database className="w-3 h-3" /> config_snapshots {isCompareMode && <span className="text-blue-600 ml-1 font-black underline">COMPARE: A → B</span>}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              setIsCompareMode(!isCompareMode);
              if (!isCompareMode) setCompareId(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCompareMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Diff className="w-3.5 h-3.5" />
            <span>{isCompareMode ? 'Exit Compare' : 'Compare Rules'}</span>
          </button>
          
          {selected && (
            <button 
              onClick={() => setShowSourceModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              <span>View XML</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* SIDEBAR */}
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Download className="w-3 h-3" /> New Capture
            </h3>
            <form onSubmit={handleRunExtraction} className="space-y-2">
              <input 
                type="text" placeholder="IP Address" value={sharedConfig.ipAddress} 
                onChange={(e) => onConfigChange({...sharedConfig, ipAddress: e.target.value})} 
                className="w-full px-3 py-2 text-[11px] border border-slate-100 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono" 
              />
              <input 
                type="password" placeholder="API Key" value={sharedConfig.apiKey} 
                onChange={(e) => onConfigChange({...sharedConfig, apiKey: e.target.value})} 
                className="w-full px-3 py-2 text-[11px] border border-slate-100 rounded-xl outline-none focus:ring-1 focus:ring-blue-500" 
              />
              <button 
                type="submit" disabled={isExtracting} 
                className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 shadow-lg hover:bg-blue-700 disabled:bg-slate-200 transition-all"
              >
                {isExtracting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                <span>{isExtracting ? 'Fetching...' : 'Extract Snapshot'}</span>
              </button>
            </form>
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshot History</h4>
              <button onClick={fetchSnapshots} className="p-1 hover:bg-slate-50 rounded"><RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar pr-1">
              {configs.map(c => {
                const isSelected = selectedId === c.id;
                const isCompared = compareId === c.id;
                
                return (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      if (isCompareMode) {
                        if (isSelected) return; 
                        setCompareId(c.id);
                      } else {
                        setSelectedId(c.id);
                      }
                    }} 
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${isSelected ? 'bg-slate-900 text-white border-slate-800 shadow-md' : isCompared ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {isCompareMode && (
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black ${isSelected ? 'bg-blue-400 text-white shadow-sm' : isCompared ? 'bg-white text-blue-600 shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
                            {isSelected ? 'A' : isCompared ? 'B' : ''}
                          </span>
                        )}
                        <p className="font-bold text-[11px] truncate">{c.hostname || 'Device'}</p>
                      </div>
                      <p className={`text-[8px] font-black uppercase ${isSelected || isCompared ? 'text-white/50' : 'text-slate-300'}`}>{new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className={`text-[9px] font-mono ${isSelected || isCompared ? 'text-white/40' : 'text-slate-400'}`}>{c.ip_address}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-12 gap-4 items-center sticky top-0 z-10">
             <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</div>
             <div className="col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rule Name & Delta Status</div>
             <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</div>
             <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</div>
             <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Application / Service</div>
             <div className="col-span-2 flex justify-end">
                {isCompareMode && <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded">Delta Detection Active</span>}
             </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                 <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parsing Rulebase...</p>
              </div>
            ) : (isCompareMode ? comparedResults : baseRules).length > 0 ? (
              <div className="divide-y divide-slate-100">
                {(isCompareMode ? (comparedResults as ComparedRule[]) : (baseRules as ComparedRule[])).map((rule, idx) => {
                  const status = isCompareMode ? rule.status : 'unchanged';
                  const isModified = status === 'modified';
                  
                  return (
                    <div key={idx} className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-all group ${status === 'added' ? 'bg-green-50/50' : status === 'removed' ? 'bg-red-50/50 opacity-60' : 'hover:bg-blue-50/30'}`}>
                        <div className="col-span-1">
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {rule.action}
                          </span>
                        </div>
                        <div className="col-span-3">
                           <div className="flex items-center gap-2">
                              <h5 className="font-bold text-slate-800 text-[11px] truncate group-hover:text-blue-600">{rule.name}</h5>
                              {status === 'added' && <Plus className="w-3 h-3 text-green-600" />}
                              {status === 'removed' && <Trash className="w-3 h-3 text-red-600" />}
                              {status === 'modified' && <Edit3 className="w-3 h-3 text-amber-600" />}
                           </div>
                           <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{rule.from} → {rule.to}</p>
                        </div>

                        {/* SOURCE */}
                        <div className="col-span-2 relative group/cell">
                          <div className={`p-2 rounded-lg border text-[10px] font-bold truncate transition-all ${isModified && rule.source !== rule.oldValue?.source ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-100/30 bg-blue-50/50 text-blue-700'}`}>
                             {rule.source}
                          </div>
                          {isModified && rule.source !== rule.oldValue?.source && (
                            <div className="absolute top-full left-0 z-20 bg-slate-900 text-white p-2 rounded text-[9px] shadow-xl opacity-0 group-hover/cell:opacity-100 transition-opacity whitespace-nowrap pointer-events-none mt-1">
                               Prev: <span className="line-through opacity-50">{rule.oldValue?.source}</span>
                            </div>
                          )}
                        </div>

                        {/* DESTINATION */}
                        <div className="col-span-2 relative group/cell">
                          <div className={`p-2 rounded-lg border text-[10px] font-bold truncate transition-all ${isModified && rule.dest !== rule.oldValue?.dest ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-100/30 bg-emerald-50/50 text-emerald-700'}`}>
                             {rule.dest}
                          </div>
                          {isModified && rule.dest !== rule.oldValue?.dest && (
                            <div className="absolute top-full left-0 z-20 bg-slate-900 text-white p-2 rounded text-[9px] shadow-xl opacity-0 group-hover/cell:opacity-100 transition-opacity whitespace-nowrap pointer-events-none mt-1">
                               Prev: <span className="line-through opacity-50">{rule.oldValue?.dest}</span>
                            </div>
                          )}
                        </div>

                        {/* APP / SERVICE */}
                        <div className="col-span-2">
                           <div className={`text-[10px] font-bold truncate ${isModified && rule.application !== rule.oldValue?.application ? 'text-amber-600' : 'text-slate-600'}`}>
                              {rule.application}
                           </div>
                           <div className={`text-[9px] font-mono truncate ${isModified && rule.service !== rule.oldValue?.service ? 'text-amber-500' : 'text-slate-400'}`}>
                              {rule.service}
                           </div>
                        </div>

                        <div className="col-span-2 flex justify-end gap-1">
                           <button onClick={() => onJumpToLogs?.(rule.name)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all" title="View Logs"><History className="w-4 h-4" /></button>
                           {isModified && (
                              <button className="p-2 text-amber-400 hover:bg-amber-50 rounded-lg transition-all" title="Review Delta"><AlertCircle className="w-4 h-4" /></button>
                           )}
                        </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                {isCompareMode ? <Columns className="w-16 h-16 mb-2" /> : <List className="w-16 h-16 mb-2" />}
                <p className="text-xs font-black uppercase tracking-widest">{isCompareMode ? 'Select Snapshot B for Comparison' : 'No Policy Data Extracted'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-8">
          <div className="bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-3"><Code className="w-4 h-4 text-blue-400" /><span className="text-xs font-black text-white uppercase tracking-widest">Snapshot Source: {selected.hostname}</span></div>
              <button onClick={() => setShowSourceModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              <pre className="text-[11px] font-mono text-blue-100/60 whitespace-pre-wrap leading-relaxed">{selected.raw_xml}</pre>
            </div>
            <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
              <button onClick={() => setShowSourceModal(false)} className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigExplorer;
