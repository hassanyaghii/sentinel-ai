
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, RefreshCw, Database, List, ArrowRight, History, 
  Code, X, FileText, AlertCircle, ShieldCheck, ShieldAlert, 
  Download, Key, Search, Globe, ChevronRight, Copy, Diff, Columns, Layers
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

  const selected = configs.find(c => c.id === selectedId);
  const compareWith = configs.find(c => c.id === compareId);

  const parseRules = (snapshot: SavedSnapshot | undefined) => {
    if (!snapshot || !snapshot.raw_xml) return [];
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(snapshot.raw_xml, "text/xml");
      const ruleEntries = xmlDoc.querySelectorAll("rules > entry, security > rules > entry, entry > rules > entry");
      
      const rules: InteractiveRule[] = [];
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

        rules.push({
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
      return rules;
    } catch (e) {
      return [];
    }
  };

  const baseRules = useMemo(() => parseRules(selected), [selected]);
  const targetRules = useMemo(() => parseRules(compareWith), [compareWith]);

  // Visual Diff Logic for XML
  const renderDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    const diffRows = [];
    for (let i = 0; i < maxLines; i++) {
      const lineA = oldLines[i] || "";
      const lineB = newLines[i] || "";
      const isDifferent = lineA.trim() !== lineB.trim();
      
      diffRows.push(
        <div key={i} className={`flex text-[10px] font-mono border-b border-white/5 ${isDifferent ? 'bg-amber-500/10' : ''}`}>
          <div className={`w-1/2 p-1 border-r border-white/5 overflow-hidden whitespace-pre ${lineA.trim() !== lineB.trim() && lineA ? 'bg-red-900/40 text-red-200' : 'text-slate-500'}`}>
            <span className="opacity-20 mr-2 select-none">{i + 1}</span>
            {lineA}
          </div>
          <div className={`w-1/2 p-1 overflow-hidden whitespace-pre ${lineA.trim() !== lineB.trim() && lineB ? 'bg-green-900/40 text-green-200' : 'text-slate-500'}`}>
            <span className="opacity-20 mr-2 select-none">{i + 1}</span>
            {lineB}
          </div>
        </div>
      );
    }
    return diffRows;
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4 relative">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Globe className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Policy Explorer</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter flex items-center gap-1">
              <Database className="w-3 h-3" /> config_snapshots {isCompareMode && <span className="text-blue-600 ml-1 font-black underline">COMPARISON ACTIVE</span>}
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
            <span>{isCompareMode ? 'Exit Compare' : 'Compare Configs'}</span>
          </button>
          
          {!isCompareMode && selected && (
            <button 
              onClick={() => setShowSourceModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              <span>View Source</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* SIDEBAR */}
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Download className="w-3 h-3" /> Pull New Snapshot
            </h3>
            <form onSubmit={handleRunExtraction} className="space-y-2">
              <input 
                type="text" placeholder="Device IP" value={sharedConfig.ipAddress} 
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
                <span>{isExtracting ? 'Fetching...' : 'Fetch Now'}</span>
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
                        if (isSelected) return; // Cant compare same
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
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black ${isSelected ? 'bg-blue-400 text-white' : isCompared ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
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
          {isCompareMode && compareWith ? (
            <div className="flex flex-col h-full bg-slate-900">
               <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-blue-500 rounded text-[9px] font-black text-white flex items-center justify-center">A</span>
                        <span className="text-[10px] text-slate-300 font-bold">{selected?.hostname} ({new Date(selected?.created_at || '').toLocaleDateString()})</span>
                     </div>
                     <ArrowRight className="w-4 h-4 text-slate-600" />
                     <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-blue-500 rounded text-[9px] font-black text-white flex items-center justify-center">B</span>
                        <span className="text-[10px] text-slate-300 font-bold">{compareWith?.hostname} ({new Date(compareWith?.created_at || '').toLocaleDateString()})</span>
                     </div>
                  </div>
                  <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Visual Delta Active</div>
               </div>
               <div className="flex-1 overflow-auto custom-scrollbar p-0">
                  {renderDiff(selected?.raw_xml || "", compareWith?.raw_xml || "")}
               </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-12 gap-4 items-center">
                 <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</div>
                 <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rule Name</div>
                 <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</div>
                 <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</div>
                 <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Application</div>
                 <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</div>
                 <div className="col-span-1"></div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-3">
                     <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reading from Database...</p>
                  </div>
                ) : baseRules.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {baseRules.map((rule, idx) => (
                      <div key={idx} className="px-6 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-blue-50/30 transition-colors group">
                          <div className="col-span-1">
                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                               {rule.action}
                            </span>
                          </div>
                          <div className="col-span-2">
                             <h5 className="font-bold text-slate-800 text-[11px] truncate group-hover:text-blue-600">{rule.name}</h5>
                             <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{rule.from} → {rule.to}</p>
                          </div>
                          <div className="col-span-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/30 font-bold text-blue-700 text-[10px] truncate">{rule.source}</div>
                          <div className="col-span-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/30 font-bold text-emerald-700 text-[10px] truncate">{rule.dest}</div>
                          <div className="col-span-2 font-bold text-slate-600 text-[10px] truncate">{rule.application}</div>
                          <div className="col-span-2 font-mono text-slate-500 text-[10px] truncate">{rule.service}</div>
                          <div className="col-span-1 flex justify-end">
                             <button onClick={() => onJumpToLogs?.(rule.name)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all"><History className="w-4 h-4" /></button>
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20">
                    {isCompareMode ? <Columns className="w-16 h-16 mb-2" /> : <List className="w-16 h-16 mb-2" />}
                    <p className="text-xs font-black uppercase tracking-widest">{isCompareMode ? 'Select Snapshot B to Start Diff' : 'No Snapshot Selected'}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-8">
          <div className="bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-3"><Code className="w-4 h-4 text-blue-400" /><span className="text-xs font-black text-white uppercase tracking-widest">Raw Snapshot XML</span></div>
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
