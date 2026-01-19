
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  RefreshCw, 
  Download,
  Activity,
  Server,
  Key,
  ShieldCheck,
  // Fix: Added missing Database icon import
  Database
} from 'lucide-react';

const CONFIG_WEBHOOK = "https://10.1.240.2/webhook/getconfig";

interface SavedConfig {
  id: string;
  timestamp: string;
  hostname: string;
  ip: string;
  raw: string;
}

interface PaloRule {
  name: string;
  from: string;
  to: string;
  source: string;
  destination: string;
  action: string;
  app: string;
  disabled: boolean;
  path: string;
}

interface ConfigExplorerProps {
  onRuleSelect?: (path: string) => void;
}

const ConfigExplorer: React.FC<ConfigExplorerProps> = ({ onRuleSelect }) => {
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

  const saveToLocal = (newConfigs: SavedConfig[]) => {
    setConfigs(newConfigs);
    localStorage.setItem('sentinel_configs', JSON.stringify(newConfigs));
  };

  const processNewConfig = (hostname: string, ip: string, raw: string) => {
    const newEntry: SavedConfig = {
      id: 'id-' + Date.now(),
      timestamp: new Date().toLocaleString(),
      hostname,
      ip,
      raw
    };
    const updated = [newEntry, ...configs];
    saveToLocal(updated);
    setSelectedId(newEntry.id);
  };

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch(CONFIG_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey, action: 'get_config' })
      });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      processNewConfig(result.hostname || ipAddress, ipAddress, result.firewallConfig || JSON.stringify(result));
    } catch (err: any) {
      setExtractError(err.message || "Failed to reach agent at 10.1.240.2");
    } finally {
      setIsExtracting(false);
    }
  };

  const parsePaloAltoXML = (raw: string) => {
    const extractEntries = (sectionRegex: RegExp) => {
      const sectionMatch = raw.match(sectionRegex);
      if (!sectionMatch) return [];
      const entryRegex = /<entry name="([^"]*)"[^>]*>([\s\S]*?)<\/entry>/gi;
      const entries = [];
      let match;
      while ((match = entryRegex.exec(sectionMatch[0])) !== null) {
        entries.push({ name: match[1], content: match[2] });
      }
      return entries;
    };

    const getMembers = (xml: string, tag: string) => {
      const tagRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
      const tagMatch = xml.match(tagRegex);
      if (!tagMatch) return "any";
      const members: string[] = [];
      const memberRegex = /<member>([^<]*)<\/member>/gi;
      let memberMatch;
      while ((memberMatch = memberRegex.exec(tagMatch[1])) !== null) members.push(memberMatch[1]);
      return members.length > 0 ? members.join(', ') : "any";
    };

    const policies: PaloRule[] = extractEntries(/<security>[\s\S]*?<rules>([\s\S]*?)<\/rules>[\s\S]*?<\/security>/i).map(e => ({
      name: e.name,
      from: getMembers(e.content, 'from'),
      to: getMembers(e.content, 'to'),
      source: getMembers(e.content, 'source'),
      destination: getMembers(e.content, 'destination'),
      action: e.content.match(/<action>([^<]*)<\/action>/i)?.[1]?.toLowerCase() || 'N/A',
      app: getMembers(e.content, 'application'),
      disabled: e.content.includes('<disabled>yes</disabled>'),
      path: e.name
    }));

    return { policies };
  };

  const selected = configs.find(c => c.id === selectedId);
  const selectedData = useMemo(() => selected ? parsePaloAltoXML(selected.raw) : null, [selected]);

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-widest uppercase">Inventory</h2>
            <p className="text-xs text-slate-400 font-medium flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Direct Link: 10.1.240.2</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration Pull</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Firewall IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="password" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <button type="submit" disabled={isExtracting} className="w-full py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center space-x-2 shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExtracting ? 'Connecting...' : 'Fetch XML Snapshot'}</span>
              </button>
            </form>
            {extractError && <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3 space-y-2">
            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">History</h4>
            <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
              {configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-600 text-white border-blue-400 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                  <p className={`font-bold text-[11px] truncate ${selectedId === c.id ? 'text-white' : 'text-slate-800'}`}>{c.hostname}</p>
                  <p className={`text-[9px] mt-1 ${selectedId === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.timestamp}</p>
                </div>
              ))}
              {configs.length === 0 && <p className="text-center py-10 text-[10px] text-slate-300 font-bold uppercase">No data stored</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {selectedData ? (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                  <tr className="text-[10px] font-black text-slate-400 uppercase">
                    <th className="px-6 py-4">Rule Name</th>
                    <th className="px-6 py-4">Addressing</th>
                    <th className="px-6 py-4">App</th>
                    <th className="px-6 py-4 text-center">Action</th>
                    <th className="px-6 py-4 text-right">Drill-down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedData.policies.map((p, i) => (
                    <tr key={i} className={`hover:bg-blue-50/20 transition-colors ${p.disabled ? 'opacity-40 italic' : ''}`}>
                      <td className="px-6 py-4 font-bold text-slate-800">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600">{p.source} → {p.destination}</td>
                      <td className="px-6 py-4 font-bold text-blue-600 uppercase text-[10px]">{p.app}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${p.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.action}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => onRuleSelect?.(p.path)}
                          className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors group"
                          title="View telemetry for this rule"
                        >
                          <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
              <Database className="w-20 h-20 mb-4" />
              <h3 className="text-xl font-bold uppercase tracking-widest">Snapshot Required</h3>
              <p className="text-sm">Fetch a new configuration snapshot from the panel to explore rules.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;
