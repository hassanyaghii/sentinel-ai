
import React, { useState, useEffect, useMemo } from 'react';
import { Shield, RefreshCw, Database, List, ArrowRight, History, Code, X, FileText, AlertCircle, ShieldCheck, ShieldAlert, Download, Key, Search, Globe } from 'lucide-react';

const SNAPSHOTS_API = "/api/config-snapshots";
const EXTRACTION_API = "/api/config"; // Routes to your n8n /getconfig webhook through server.js

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
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onJumpToLogs }) => {
  const [configs, setConfigs] = useState<SavedSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);

  // Extraction Form State
  const [ipAddress, setIpAddress] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Fetch from MySQL 'config_snapshots' table
  const fetchSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Note: The backend route /api/config-snapshots must be implemented in server.js 
      // to query: SELECT * FROM config_snapshots ORDER BY created_at DESC
      const response = await fetch(SNAPSHOTS_API);
      if (!response.ok) throw new Error("Failed to fetch snapshots from MySQL table 'config_snapshots'");
      const data = await response.json();
      setConfigs(data);
      
      if (data.length > 0 && selectedId === null) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      console.error("Database fetch error:", err);
      setError("Could not load snapshots. Ensure 'config_snapshots' table exists.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger n8n Workflow (Analyze Firewall Webhook / getconfig)
  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress || !apiKey) {
      setError("Firewall IP and API Key are required.");
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
      
      if (!response.ok) throw new Error("n8n extraction failed. Check n8n logs.");

      // Success! Give n8n a second to finish the MySQL insert, then refresh
      setTimeout(() => {
        fetchSnapshots();
        setIpAddress('');
        setApiKey('');
        setIsExtracting(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to trigger n8n agent");
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
      // Use text/xml parser for the raw_xml content from MySQL
      const xmlDoc = parser.parseFromString(selected.raw_xml, "text/xml");
      
      // Flexible selector to handle various n8n xpath outputs
      // Searches for <entry> nodes that contain a <rulebase> or <action>
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

        // Standard Palo Alto Security Rule Fields
        const actionTag = entry.querySelector("action");
        if (!actionTag) return; // Skip entries that aren't actually security rules

        const action = actionTag.textContent || "allow";
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
      {/* TOP HEADER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Globe className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory Explorer</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1 uppercase tracking-tighter">
              <Database className="w-3 h-3" />
              <span>Source: config_snapshots</span>
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
        {/* SIDEBAR: INPUT & HISTORY */}
        <div className="w-72 flex flex-col space-y-4 shrink-0 overflow-hidden">
          {/* TRIGGER FORM */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm shrink-0">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Download className="w-3 h-3" /> Trigger Extraction
            </h3>
            <form onSubmit={handleRunExtraction} className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input 
                  type="text" placeholder="Firewall IP" value={ipAddress} 
                  onChange={(e) => setIpAddress(e.target.value)} 
                  className="w-full pl-8 pr-3 py-1.5 text-[10px] border border-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono" 
                />
              </div>
              <div className="relative">
                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input 
                  type="password" placeholder="API Key" value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  className="w-full pl-8 pr-3 py-1.5 text-[10px] border border-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500" 
                />
              </div>
              <button 
                type="submit" disabled={isExtracting} 
                className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 shadow hover:bg-blue-700 transition-all disabled:bg-slate-200"
              >
                {isExtracting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                <span>{isExtracting ? 'Extracting...' : 'Get New Config'}</span>
              </button>
            </form>
          </div>

          {/* SNAPSHOT LIST */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshot History</h4>
              <button onClick={fetchSnapshots} className="p-1 hover:bg-slate-50 rounded"><RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar pr-1">
              {configs.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedId(c.id)} 
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[10px] truncate">{c.hostname || 'Unknown Host'}</p>
                    <FileText className={`w-3 h-3 ${selectedId === c.id ? 'text-blue-200' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-[8px] font-mono ${selectedId === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.ip_address || '0.0.0.0'}</p>
                    <p className={`text-[7px] font-bold ${selectedId === c.id ? 'text-blue-200' : 'text-slate-300'}`}>{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {configs.length === 0 && !isLoading && (
                <div className="py-12 text-center opacity-20">
                   <Database className="w-8 h-8 mx-auto mb-2" />
                   <p className="text-[9px] font-black uppercase">No Data in MySQL</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN DISPLAY: SECURITY RULES */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Parsed Security Policy</span>
                {selected && <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">ID #{selected.id}</span>}
             </div>
             <List className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
             {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                   <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying MySQL...</p>
                </div>
             ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 space-y-2">
                   <AlertCircle className="w-10 h-10" />
                   <p className="text-xs font-black uppercase">{error}</p>
                   <button onClick={fetchSnapshots} className="text-[10px] font-black underline mt-2">Retry Database Fetch</button>
                </div>
             ) : parsedRules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {parsedRules.map((rule, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-2 truncate">
                            {rule.action === 'allow' ? <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <h5 className="font-black text-slate-800 text-[10px] truncate uppercase" title={rule.name}>{rule.name}</h5>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rule.action}</span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="grid grid-cols-2 gap-2 text-[9px]">
                             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">From Zone</span>
                                <span className="font-bold text-slate-700 truncate block">{rule.from}</span>
                             </div>
                             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">To Zone</span>
                                <span className="font-bold text-slate-700 truncate block">{rule.to}</span>
                             </div>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[9px]">
                             <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Source / Dest</span>
                             <div className="flex items-center justify-between font-bold text-slate-600">
                                <span className="truncate flex-1 text-blue-600">{rule.source}</span>
                                <ArrowRight className="w-3 h-3 text-slate-300 mx-1" />
                                <span className="truncate flex-1 text-right text-emerald-600">{rule.dest}</span>
                             </div>
                          </div>

                          <div className="bg-slate-900/5 p-2 rounded-lg border border-slate-200/50 flex justify-between items-center text-[9px]">
                             <div>
                                <span className="text-[7px] font-black text-slate-400 uppercase block">App</span>
                                <span className="font-bold text-slate-700 truncate block">{rule.application}</span>
                             </div>
                             <div className="text-right">
                                <span className="text-[7px] font-black text-slate-400 uppercase block">Port/Service</span>
                                <span className="font-bold text-slate-500 truncate block">{rule.service}</span>
                             </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => onJumpToLogs?.(rule.name)}
                          className="w-full py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded flex items-center justify-center space-x-2 transition-all hover:bg-black active:scale-95 shadow-sm"
                        >
                          <History className="w-3 h-3 text-blue-400" />
                          <span>Drilldown Audit Logs</span>
                        </button>
                    </div>
                  ))}
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <List className="w-12 h-12 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">
                    {selected ? "Xpath did not contain rule entries" : "Select a Snapshot to view rules"}
                  </p>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* RAW XML INSPECTOR MODAL */}
      {showSourceModal && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6">
          <div className="bg-slate-900 w-full max-w-5xl h-[80vh] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-3">
                <Code className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="text-xs font-black text-white uppercase tracking-widest block">Raw Database Snapshot XML</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">Record #{selected.id} - {selected.hostname}</span>
                </div>
              </div>
              <button onClick={() => setShowSourceModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              <pre className="text-[10px] font-mono text-blue-100/60 whitespace-pre-wrap leading-relaxed">
                {selected.raw_xml}
              </pre>
            </div>
            <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
              <button onClick={() => setShowSourceModal(false)} className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-blue-500 transition-all">Close Inspector</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigExplorer;
