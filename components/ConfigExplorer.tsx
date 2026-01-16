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
  Activity,
  Diff,
  Download,
  PlusCircle,
  MinusCircle,
  Zap,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight
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

// Utility for safe UUID generation in non-HTTPS environments
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
      const rawContent = result.raw || (result.json ? JSON.stringify(result.json, null, 2) : JSON.stringify(result, null, 2));
      
      processNewConfig(result.hostname || ipAddress, ipAddress, rawContent);
    } catch (err: any) {
      setExtractError(err.message || "Connection refused.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => processNewConfig(file.name, "Local Import", event.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const parsePaloAltoXML = (raw: string) => {
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

    const getMember = (xml: string, tag: string) => {
      const regex = new RegExp(`<${tag}>[\\s\\S]*?<member>([^<]*)<\\/member>`, "i");
      const match = xml.match(regex);
      return match ? match[1] : "any";
    };

    const getSimpleTag = (xml: string, tag: string) => {
      const regex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i");
      const match = xml.match(regex);
      return match ? match[1] : "N/A";
    };

    const getInterfaceIP = (xml: string) => {
      const ipEntryRegex = /<ip>[\s\S]*?<entry name="([^"]*)"/i;
      const match = xml.match(ipEntryRegex);
      return match ? match[1] : "unassigned";
    };

    const policies: PaloRule[] = extractEntries(/<security>[\s\S]*?<rules>([\s\S]*?)<\/rules>[\s\S]*?<\/security>/i).map(e => ({
      name: e.name,
      from: getMember(e.content, 'from'),
      to: getMember(e.content, 'to'),
      source: getMember(e.content, 'source'),
      destination: getMember(e.content, 'destination'),
      action: getSimpleTag(e.content, 'action').toLowerCase(),
      app: getMember(e.content, 'application'),
      disabled: e.content.includes('<disabled>yes</disabled>')
    }));

    const nat = extractEntries(/<nat>[\s\S]*?<rules>([\s\S]*?)<\/rules>[\s\S]*?<\/nat>/i).map(e => ({
      name: e.name,
      from: getMember(e.content, 'from'),
      to: getMember(e.content, 'to'),
      source: getMember(e.content, 'source'),
      dest: getMember(e.content, 'destination'),
      translated: getSimpleTag(e.content, 'translated-address') || "Masquerade"
    }));

    const interfaces: PaloInterface[] = extractEntries(/<ethernet>([\s\S]*?)<\/ethernet>/i).map(e => ({
      name: e.name,
      ip: getInterfaceIP(e.content),
      status: 'up'
    })).filter(i => i.name.includes('ethernet'));

    return { policies, nat, interfaces };
  };

  const selected = configs.find(c => c.id === selectedId);
  const comparison = configs.find(c => c.id === compareId);
  const selectedData = useMemo(() => selected ? parsePaloAltoXML(selected.raw) : null, [selected]);
  const compareData = useMemo(() => comparison ? parsePaloAltoXML(comparison.raw) : null, [comparison]);

  const getDirection = (from: string, to: string) => {
    const extKeywords = ['wan', 'outside', 'ext', 'untrust', 'internet'];
    const fromExt = extKeywords.some(k => from.toLowerCase().includes(k));
    const toExt = extKeywords.some(k => to.toLowerCase().includes(k));
    if (fromExt && !toExt) return 'Inbound';
    if (!fromExt && toExt) return 'Outbound';
    return 'Internal';
  };

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
        if (prev.disabled !== curr.disabled) changes.push('status');
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

  const DiffValue = ({ current, previous, type, isChanged }: { current: string, previous?: string, type: 'added' | 'removed' | 'modified' | 'unchanged', isChanged: boolean }) => {
    if (type === 'removed') return <span className="text-red-700 line-through font-bold decoration-2 decoration-red-900/50">{current}</span>;
    if (type === 'added') return <span className="text-emerald-700 font-black">{current}</span>;
    if (!isChanged || !previous) return <span className="text-slate-700">{current}</span>;
    return (
      <div className="flex flex-col text-[10px]">
        <span className="text-red-400 line-through opacity-60 mb-0.5">{previous}</span>
        <span className="text-blue-600 font-bold bg-blue-50 px-1 rounded border border-blue-100/50">{current}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[85vh] space-y-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span>CONFIG EXPLORER</span>
              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded uppercase font-black tracking-widest">v2.1-ARCHITECT</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium italic">
              Enterprise Snapshot Management & Delta Analysis Engine
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              setViewMode(viewMode === 'view' ? 'compare' : 'view');
              setCompareId(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${
              viewMode === 'compare' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Diff className="w-4 h-4" />
            <span>{viewMode === 'compare' ? 'Single View' : 'Compare Snapshot'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden gap-6">
        {/* Sidebar */}
        <div className="w-80 flex flex-col space-y-4 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Snapshot Puller</span>
              <Activity className="w-3 h-3 text-blue-500" />
            </h3>
            <form onSubmit={handleRunExtraction} className="space-y-3">
              <input 
                type="text" placeholder="Firewall Management IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)}
                className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner"
              />
              <input 
                type="password" placeholder="API Access Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner"
              />
              <input 
                type="text" placeholder="n8n Webhook URL" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner"
              />
              <button 
                type="submit" disabled={isExtracting}
                className="w-full py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Fetch from Agent</span>
              </button>
            </form>
            {extractError && <p className="text-[9px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History Buffer</h3>
              <div className="flex items-center space-x-2">
                <label className="p-1 hover:bg-slate-200 rounded cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <input type="file" className="hidden" accept=".xml" onChange={handleFileUpload} />
                </label>
                <Database className="w-3 h-3 text-slate-300" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {configs.length > 0 ? configs.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedId(c.id)}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${selectedId === c.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                >
                  <p className="font-bold text-slate-800 text-[11px] truncate pr-6">{c.hostname}</p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tight">{c.timestamp}</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); saveToLocal(configs.filter(x => x.id !== c.id)); }}
                    className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )) : (
                <div className="text-center p-8 opacity-20 flex flex-col items-center">
                  <Search className="w-10 h-10 mb-2" />
                  <p className="text-[10px] font-black uppercase">No Snapshots</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Display Area */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
              <Shield className="w-20 h-20 opacity-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Select a Snapshot from Sidebar</p>
            </div>
          ) : (
            <>
              {/* Contextual Toolbar */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                {viewMode === 'view' ? (
                  <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl">
                    {(['security', 'nat', 'interfaces', 'raw'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-2 rounded-xl border border-slate-200">
                      <span>Baseline: {selected.hostname}</span>
                    </div>
                    <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                    <select 
                      className="bg-white border-2 border-blue-600 text-[10px] font-black uppercase tracking-widest text-blue-600 px-4 py-2 rounded-xl outline-none shadow-sm focus:ring-4 focus:ring-blue-50"
                      value={compareId || ''}
                      onChange={(e) => setCompareId(e.target.value)}
                    >
                      <option value="">Choose Target Snapshot...</option>
                      {configs.filter(c => c.id !== selected.id).map(c => (
                        <option key={c.id} value={c.id}>{c.hostname} ({c.timestamp})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center space-x-6 text-[9px] font-black uppercase tracking-widest">
                   <div className="flex items-center space-x-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm" /> <span className="text-emerald-700">Added</span></div>
                   <div className="flex items-center space-x-1.5"><div className="w-2 h-2 bg-red-500 rounded-full shadow-sm" /> <span className="text-red-700">Removed</span></div>
                </div>
              </div>

              {/* Work Area */}
              <div className="flex-1 overflow-auto custom-scrollbar">
                {viewMode === 'compare' && compareData ? (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-slate-100">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4 w-12 text-center">Δ</th>
                        <th className="px-6 py-4">Policy Name</th>
                        <th className="px-6 py-4">Zones</th>
                        <th className="px-6 py-4">App</th>
                        <th className="px-6 py-4">Matching</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {diffData?.map((diff, idx) => (
                        <tr key={idx} className={`transition-all border-l-4 ${
                          diff.type === 'added' ? 'bg-emerald-50 border-emerald-500' : 
                          diff.type === 'removed' ? 'bg-red-50 border-red-500 shadow-sm opacity-90' : 
                          diff.type === 'modified' ? 'bg-amber-50/40 border-amber-400' : 'border-transparent'
                        }`}>
                          <td className="px-6 py-4 text-center">
                            {diff.type === 'added' && <PlusCircle className="w-4 h-4 text-emerald-600 mx-auto" />}
                            {diff.type === 'removed' && <MinusCircle className="w-4 h-4 text-red-600 mx-auto" />}
                            {diff.type === 'modified' && <Zap className="w-4 h-4 text-amber-500 animate-pulse mx-auto" />}
                            {diff.type === 'unchanged' && <CheckCircle2 className="w-4 h-4 text-slate-200 mx-auto" />}
                          </td>
                          <td className="px-6 py-4 font-bold text-[11px]">
                             <span className={diff.type === 'removed' ? 'line-through text-red-900/60 decoration-2' : diff.type === 'added' ? 'text-emerald-800 font-black' : 'text-slate-800'}>
                                {diff.name}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                            <DiffValue 
                              type={diff.type as any}
                              current={`${diff.current!.from}→${diff.current!.to}`} 
                              previous={diff.previous ? `${diff.previous.from}→${diff.previous.to}` : undefined} 
                              isChanged={!!diff.changes?.includes('zones')} 
                            />
                          </td>
                          <td className="px-6 py-4">
                            <DiffValue 
                              type={diff.type as any}
                              current={diff.current!.app} 
                              previous={diff.previous?.app} 
                              isChanged={!!diff.changes?.includes('application')} 
                            />
                          </td>
                          <td className="px-6 py-4">
                            <DiffValue 
                              type={diff.type as any}
                              current={`${diff.current!.source}/${diff.current!.destination}`} 
                              previous={diff.previous ? `${diff.previous.source}/${diff.previous.destination}` : undefined} 
                              isChanged={!!diff.changes?.includes('addresses')} 
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DiffValue 
                              type={diff.type as any}
                              current={diff.current!.action} 
                              previous={diff.previous?.action} 
                              isChanged={!!diff.changes?.includes('action')} 
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : viewMode === 'compare' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-300">
                    <Search className="w-10 h-10 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Choose a target to compare</p>
                  </div>
                ) : (
                  /* Standard Views */
                  <div className="p-0">
                    {activeTab === 'security' && selectedData && (
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-slate-100">
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4 w-12">#</th>
                            <th className="px-6 py-4">Policy Name</th>
                            <th className="px-6 py-4">Flow</th>
                            <th className="px-6 py-4">Zones</th>
                            <th className="px-6 py-4">App</th>
                            <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedData.policies.map((p, i) => (
                            <tr key={i} className={`hover:bg-slate-50 group ${p.disabled ? 'text-slate-300 italic' : ''}`}>
                              <td className="px-6 py-3 font-mono text-[10px] opacity-30">{i + 1}</td>
                              <td className="px-6 py-3 font-bold text-[11px] text-slate-800">{p.name}</td>
                              <td className="px-6 py-3">
                                <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {getDirection(p.from, p.to)}
                                </span>
                              </td>
                              <td className="px-6 py-3 font-mono text-[10px] text-slate-500">{p.from} → {p.to}</td>
                              <td className="px-6 py-3 font-bold text-blue-600 uppercase text-[10px] tracking-tight">{p.app}</td>
                              <td className="px-6 py-3 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  p.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {p.action}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    
                    {activeTab === 'nat' && selectedData && (
                       <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectedData.nat.map((n, i) => (
                          <div key={i} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-blue-200 transition-all">
                            <div className="flex items-center justify-between mb-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                               <span className="border px-1.5 py-0.5 rounded">NAT Entry</span>
                               <Globe className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-xs mb-3 truncate">{n.name}</h4>
                            <div className="flex items-center justify-between text-[10px] font-mono p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-slate-500">{n.source}</span>
                              <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                              <span className="text-blue-600 font-bold">{n.translated}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'interfaces' && selectedData && (
                      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectedData.interfaces.map((int, i) => (
                          <div key={i} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col justify-between h-36">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                 <div className="p-1.5 bg-slate-900 rounded-lg text-white"><Network className="w-3.5 h-3.5" /></div>
                                 <span className="font-bold text-slate-800 text-xs">{int.name}</span>
                              </div>
                              <div className="flex items-center space-x-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">UP</span></div>
                            </div>
                            <div className="mt-4">
                               <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">IP Assignment</p>
                               <p className="text-[11px] font-mono font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">{int.ip}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'raw' && selected && (
                      <div className="bg-slate-900 p-8 text-blue-200 font-mono text-[11px] overflow-auto h-full leading-relaxed custom-scrollbar">
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