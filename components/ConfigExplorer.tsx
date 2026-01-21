
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Database, List, ArrowRight, History, Code, X, FileText, AlertCircle, ShieldCheck, ShieldAlert, Download, Key, Search } from 'lucide-react';

const SNAPSHOTS_API = "/api/config-snapshots";
const EXTRACTION_API = "/api/config"; // Routes to your n8n /getconfig webhook

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
  application: string;
  service: string;
}

interface ConfigExplorerProps {
  onJumpToLogs?: (path: string) => void;
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onJumpToLogs }) => {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);

  // Inputs for triggering n8n getconfig
  const [ipAddress, setIpAddress] = useState('');
  const [apiKey, setApiKey] = useState('');

  const fetchSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(SNAPSHOTS_API);
      if (!response.ok) throw new Error("Failed to fetch snapshots from database");
      const data = await response.json();
      
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
      setError("Could not load snapshots from MySQL.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress || !apiKey) {
      setError("IP Address and API Key are required to pull config.");
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch(EXTRACTION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey, vendor: 'paloalto' })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "n8n Extraction failed");
      }

      // After n8n saves to DB, refresh our list
      await fetchSnapshots();
      setIpAddress('');
      setApiKey('');
    } catch (err: any) {
      setError(err.message || "Failed to reach n8n agent");
    } finally {
      setIsExtracting(false);
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
      let xmlString = selected.raw_xml.trim();
      if (!xmlString.startsWith('<?xml') && !xmlString.startsWith('<response')) {
        xmlString = `<root>${xmlString}</root>`;
      }
      
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");
      const ruleEntries = xmlDoc.querySelectorAll("rules > entry, security > rules > entry");
      
      const rules: InteractiveRule[] = [];
      ruleEntries.forEach((entry) => {
        const isSecurityRule = entry.parentElement?.tagName === 'rules' && 
                             (entry.parentElement.parentElement?.tagName === 'security' || 
                              entry.querySelector('action'));
        
        if (!isSecurityRule) return;

        const name = entry.getAttribute("name") || "Unnamed Rule";
        
        const getMembers = (tagName: string) => {
          const tag = entry.querySelector(tagName);
          if (!tag) return "any";
          const members = Array.from(tag.querySelectorAll("member")).map(m => m.textContent?.trim());
          return members.length > 0 ? members.join(", ") : "any";
        };

        const action = entry.querySelector("action")?.textContent || "allow";
        const from = getMembers("from");
        const to = getMembers("to");
        const source = getMembers("source");
        const dest = getMembers("destination");
        const app = getMembers("application");
        const service = getMembers("service");

        rules.push({
          name,
          action: action.toLowerCase(),
          from,
          to,
          source,
          dest,
          application: app,
          service: service
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
              <span>Analyzing Snapshots from MySQL</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
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
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* SIDEBAR */}
        <div className="w-72 flex flex-col space-y-4 shrink-0">
          {/* EXTRACTION FORM */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Download className="w-3 h-3" /> Pull Configuration
            </h3>
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
                className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all disabled:bg-slate-300 active:scale-95"
              >
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExtracting ? 'Extracting...' : 'Get Config'}</span>
              </button>
            </form>
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <div className="flex items-center justify-between mb-3 px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshots</h4>
              <button onClick={fetchSnapshots} className="text-slate-400 hover:text-blue-600"><RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /></button>
            </div>
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
            </div>
          </div>
        </div>

        {/* MAIN PANEL */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Extracted Security Rules</span>
                {selected && <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">vsys1</span>}
             </div>
             <List className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
             {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                   <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parsing Database XML...</p>
                </div>
             ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 space-y-2">
                   <AlertCircle className="w-10 h-10" />
                   <p className="text-xs font-bold uppercase">{error}</p>
                   <button onClick={fetchSnapshots} className="text-[10px] font-black underline">Retry Load</button>
                </div>
             ) : parsedRules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {parsedRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-2 truncate">
                            {rule.action === 'allow' ? <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <h5 className="font-black text-slate-800 text-[11px] truncate uppercase" title={rule.name}>{rule.name}</h5>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rule.action}</span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="grid grid-cols-2 gap-2">
                             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-hidden">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">From Zone</span>
                                <span className="text-[10px] font-bold text-slate-700 truncate block">{rule.from}</span>
                             </div>
                             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-hidden">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">To Zone</span>
                                <span className="text-[10px] font-bold text-slate-700 truncate block">{rule.to}</span>
                             </div>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-hidden">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Source / Dest</span>
                             <div className="flex items-center justify-between text-[9px] font-bold text-slate-600">
                                <span className="truncate flex-1 text-blue-600">{rule.source}</span>
                                <ArrowRight className="w-3 h-3 text-slate-300 mx-1" />
                                <span className="truncate flex-1 text-right text-emerald-600">{rule.dest}</span>
                             </div>
                          </div>

                          <div className="bg-slate-900/5 p-2 rounded-lg border border-slate-200/50 flex justify-between items-center">
                             <div className="overflow-hidden">
                                <span className="text-[7px] font-black text-slate-400 uppercase block">App</span>
                                <span className="text-[9px] font-bold text-slate-700 truncate block">{rule.application}</span>
                             </div>
                             <div className="text-right overflow-hidden ml-2">
                                <span className="text-[7px] font-black text-slate-400 uppercase block">Service</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate block">{rule.service}</span>
                             </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => onJumpToLogs?.(rule.name)}
                          className="w-full py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 transition-all hover:bg-black active:scale-95 shadow-sm"
                        >
                          <History className="w-3 h-3 text-blue-400" />
                          <span>Drilldown Logs</span>
                        </button>
                    </div>
                  ))}
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <List className="w-12 h-12 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {selected ? "Xpath did not contain rulebase" : "Enter IP & Key to pull data"}
                  </p>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-8">
          <div className="bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-3">
                <Code className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="text-xs font-black text-white uppercase tracking-widest block">Raw Snapshot XML</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">{selected.hostname}</span>
                </div>
              </div>
              <button onClick={() => setShowSourceModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              <pre className="text-[11px] font-mono text-blue-100/60 whitespace-pre-wrap leading-relaxed">
                {selected.raw_xml}
              </pre>
            </div>
            <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
              <button onClick={() => setShowSourceModal(false)} className="px-8 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-500 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigExplorer;
