import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Globe, 
  Network, 
  ArrowRightLeft, 
  Trash2, 
  Upload, 
  RefreshCw, 
  Database,
  Search,
  Diff,
  Download,
  PlusCircle,
  MinusCircle,
  Zap,
  CheckCircle2,
  Activity
} from 'lucide-react';

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
}

interface PaloInterface {
  name: string;
  ip: string;
  status: string;
}

const generateSafeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
};

const ConfigExplorer: React.FC = () => {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'compare'>('view');
  const [activeTab, setActiveTab] = useState<'security' | 'nat' | 'interfaces' | 'raw'>('security');
  
  const [ipAddress, setIpAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
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
      id: generateSafeId(),
      timestamp: new Date().toLocaleString(),
      hostname,
      ip,
      raw
    };
    const updated = [newEntry, ...configs];
    saveToLocal(updated);
    setSelectedId(newEntry.id);
    setViewMode('view');
  };

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    setExtractError(null);

    try {
      if (!webhookUrl) throw new Error("n8n Webhook URL is required.");
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress, apiKey, action: 'get_config' })
      });

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      
      const rawContent = result.firewallConfig || result.raw || (result.json ? JSON.stringify(result.json, null, 2) : JSON.stringify(result, null, 2));
      
      processNewConfig(result.hostname || ipAddress, ipAddress, rawContent);
    } catch (err: any) {
      setExtractError(err.message || "Connection refused.");
    } finally {
      setIsExtracting(false);
    }
  };

  const parsePaloAltoXML = (rawInput: string) => {
    let raw = rawInput;
    try {
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        if (parsed.firewallConfig) raw = parsed.firewallConfig;
      }
    } catch (e) {}

    const extractEntries = (sectionRegex: RegExp) => {
      const sectionMatch = raw.match(sectionRegex);
      if (!sectionMatch) return [];
      const sectionContent = sectionMatch[0];
      const entryRegex = /<entry name="([^"]*)"[^>]*>([\s\S]*?)<\/entry>/gi;
      const entries = [];
      let match;
      while ((match = entryRegex.exec(sectionContent)) !== null) {
        entries.push({ name: match[1], content: match[2] });
      }
      return entries;
    };

    const getMembers = (xml: string, tag: string) => {
      // Find the specific parent tag (e.g., <from>, <to>, <source>)
      const tagRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
      const tagMatch = xml.match(tagRegex);
      if (!tagMatch) return "any";
      
      const content = tagMatch[1];
      const members: string[] = [];
      const memberRegex = /<member>([^<]*)<\/member>/gi;
      let memberMatch;
      while ((memberMatch = memberRegex.exec(content)) !== null) {
        members.push(memberMatch[1]);
      }
      return members.length > 0 ? members.join(', ') : "any";
    };

    const getSimpleTag = (xml: string, tag: string) => {
      const regex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i");
      const match = xml.match(regex);
      return match ? match[1] : "N/A";
    };

    const policies: PaloRule[] = extractEntries(/<security>[\s\S]*?<rules>([\s\S]*?)<\/rules>[\s\S]*?<\/security>/i).map(e => ({
      name: e.name,
      from: getMembers(e.content, 'from'),
      to: getMembers(e.content, 'to'),
      source: getMembers(e.content, 'source'),
      destination: getMembers(e.content, 'destination'),
      action: getSimpleTag(e.content, 'action').toLowerCase(),
      app: getMembers(e.content, 'application'),
      disabled: e.content.includes('<disabled>yes</disabled>')
    }));

    const nat = extractEntries(/<nat>[\s\S]*?<rules>([\s\S]*?)<\/rules>[\s\S]*?<\/nat>/i).map(e => ({
      name: e.name,
      from: getMembers(e.content, 'from'),
      to: getMembers(e.content, 'to'),
      source: getMembers(e.content, 'source'),
      dest: getMembers(e.content, 'destination'),
      translated: getSimpleTag(e.content, 'translated-address') || "Masquerade"
    }));

    const interfaces: PaloInterface[] = extractEntries(/<zone>([\s\S]*?)<\/zone>/i).map(e => ({
      name: e.name,
      ip: getMembers(e.content, 'layer3'),
      status: 'up'
    }));

    return { policies, nat, interfaces };
  };

  const selected = configs.find(c => c.id === selectedId);
  const comparison = configs.find(c => c.id === compareId);
  const selectedData = useMemo(() => selected ? parsePaloAltoXML(selected.raw) : null, [selected]);
  const compareData = useMemo(() => comparison ? parsePaloAltoXML(comparison.raw) : null, [comparison]);

  const diffData = useMemo(() => {
    if (!selectedData || !compareData) return null;
    const allNames = Array.from(new Set([
      ...selectedData.policies.map(p => p.name),
      ...compareData.policies.map(p => p.name)
    ]));

    return allNames.map(name => {
      const prev = selectedData.policies.find(p => p.name === name);
      const curr = compareData.policies.find(p => p.name === name);
      if (!prev && curr) return { name, type: 'added', current: curr, previous: null, changes: [] };
      if (prev && !curr) return { name, type: 'removed', current: prev, previous: null, changes: [] };
      const changes = [];
      if (prev && curr) {
        if (prev.action !== curr.action) changes.push('action');
        if (prev.from !== curr.from || prev.to !== curr.to) changes.push('zones');
        if (prev.source !== curr.source || prev.destination !== curr.destination) changes.push('addresses');
        if (prev.app !== curr.app) changes.push('application');
      }
      return { 
        name, 
        type: changes.length > 0 ? 'modified' : 'unchanged', 
        current: curr || prev, 
        previous: prev,
        changes 
      };
    });
  }, [selectedData, compareData]);

  const DiffValue = ({ current, previous, type, isChanged }: { current: string, previous?: string, type: string, isChanged: boolean }) => {
    if (type === 'removed') return <span className="text-red-700 line-through">{current}</span>;
    if (type === 'added') return <span className="text-emerald-700 font-bold">{current}</span>;
    if (!isChanged || !previous) return <span className="text-slate-700">{current}</span>;
    return (
      <div className="flex flex-col text-[10px]">
        <span className="text-red-400 line-through opacity-50">{previous}</span>
        <span className="text-blue-600 font-bold">{current}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight tracking-widest">CONFIG EXPLORER</h2>
            <p className="text-xs text-slate-400 font-medium">Visualizing {selected?.hostname || 'Snapshots'}</p>
          </div>
        </div>
        <button 
          onClick={() => { setViewMode(viewMode === 'view' ? 'compare' : 'view'); setCompareId(null); }}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${viewMode === 'compare' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
        >
          <Diff className="w-4 h-4" />
          <span>{viewMode === 'compare' ? 'Single View' : 'Compare Snapshot'}</span>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshot Puller</h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <input type="text" placeholder="Management IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none" />
              <input type="password" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none" />
              <input type="text" placeholder="Webhook URL" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none" />
              <button type="submit" disabled={isExtracting} className="w-full py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center justify-center space-x-2">
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Fetch Snapshot</span>
              </button>
            </form>
            {extractError && <p className="text-[9px] text-red-500 font-bold bg-red-50 p-2 rounded-lg">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History Buffer</h3>
              <Database className="w-3 h-3 text-slate-300" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {configs.length > 0 ? configs.map(c => (
                <div key={c.id} onClick={() => setSelectedId(c.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                  <p className="font-bold text-slate-800 text-[11px] truncate">{c.hostname}</p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">{c.timestamp}</p>
                </div>
              )) : (
                <div className="p-8 text-center opacity-20"><Search className="w-8 h-8 mx-auto mb-2" /><p className="text-[10px] uppercase font-black">Empty</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
              <Shield className="w-20 h-20 opacity-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">Select a Snapshot</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                {viewMode === 'view' ? (
                  <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl">
                    {(['security', 'nat', 'interfaces', 'raw'] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab}</button>
                    ))}
                  </div>
                ) : (
                  <select className="bg-white border border-slate-200 text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none shadow-sm focus:ring-2 focus:ring-blue-100" value={compareId || ''} onChange={(e) => setCompareId(e.target.value)}>
                    <option value="">Choose comparison target...</option>
                    {configs.filter(c => c.id !== selected.id).map(c => <option key={c.id} value={c.id}>{c.hostname} ({c.timestamp})</option>)}
                  </select>
                )}
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                {viewMode === 'compare' && compareData ? (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white shadow-sm border-b border-slate-100">
                      <tr className="text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-4">Δ</th>
                        <th className="px-6 py-4">Rule Name</th>
                        <th className="px-6 py-4">Zones</th>
                        <th className="px-6 py-4">Addressing</th>
                        <th className="px-6 py-4">App</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffData?.map((diff, i) => (
                        <tr key={i} className={`border-b border-slate-50 transition-colors ${diff.type === 'added' ? 'bg-emerald-50' : diff.type === 'removed' ? 'bg-red-50' : diff.type === 'modified' ? 'bg-amber-50' : ''}`}>
                          <td className="px-6 py-4 text-center font-bold">{diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : 'Δ'}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">{diff.name}</td>
                          <td className="px-6 py-4"><DiffValue type={diff.type} current={`${diff.current!.from} → ${diff.current!.to}`} previous={diff.previous ? `${diff.previous.from} → ${diff.previous.to}` : undefined} isChanged={diff.changes.includes('zones')} /></td>
                          <td className="px-6 py-4"><DiffValue type={diff.type} current={`${diff.current!.source} / ${diff.current!.destination}`} previous={diff.previous ? `${diff.previous.source} / ${diff.previous.destination}` : undefined} isChanged={diff.changes.includes('addresses')} /></td>
                          <td className="px-6 py-4"><DiffValue type={diff.type} current={diff.current!.app} previous={diff.previous?.app} isChanged={diff.changes.includes('application')} /></td>
                          <td className="px-6 py-4 text-right font-bold uppercase">{diff.current!.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-0">
                    {activeTab === 'security' && selectedData && (
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-white border-b border-slate-100">
                          <tr className="text-[10px] font-black text-slate-400 uppercase">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Zones</th>
                            <th className="px-6 py-4">Source</th>
                            <th className="px-6 py-4">Destination</th>
                            <th className="px-6 py-4">Application</th>
                            <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedData.policies.map((p, i) => (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${p.disabled ? 'opacity-40 italic' : ''}`}>
                              <td className="px-6 py-4 font-bold text-slate-800">{p.name}</td>
                              <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{p.from} → {p.to}</td>
                              <td className="px-6 py-4 text-slate-600">{p.source}</td>
                              <td className="px-6 py-4 text-slate-600">{p.destination}</td>
                              <td className="px-6 py-4 font-bold text-blue-600 uppercase text-[10px]">{p.app}</td>
                              <td className="px-6 py-4 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.action}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    
                    {activeTab === 'interfaces' && selectedData && (
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectedData.interfaces.map((int, i) => (
                          <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col justify-between h-40 hover:border-blue-200 transition-all">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center space-x-2">
                                 <div className="p-2 bg-slate-900 rounded-lg text-white"><Network className="w-4 h-4" /></div>
                                 <span className="font-bold text-slate-800">{int.name}</span>
                               </div>
                               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                             </div>
                             <div className="mt-4">
                               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Members</p>
                               <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 truncate">{int.ip}</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'raw' && selected && (
                      <div className="bg-slate-900 p-8 text-blue-200 font-mono text-[10px] overflow-auto h-full leading-relaxed custom-scrollbar">
                        <pre className="whitespace-pre-wrap">{selected.raw}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;