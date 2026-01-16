import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowUpRight,
  Terminal,
  Clock,
  User,
  Monitor,
  ChevronRight
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

interface ConfigLog {
  time: string;
  admin: string;
  host: string;
  client: string;
  cmd: string;
  result: string;
  path: string;
  before: string;
  after: string;
  sequence: string;
}

const ConfigExplorer: React.FC = () => {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'compare'>('view');
  const [activeTab, setActiveTab] = useState<'security' | 'nat' | 'interfaces' | 'monitor' | 'raw'>('security');
  
  const [ipAddress, setIpAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [jobId, setJobId] = useState('28');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  
  // Monitor State
  const [logs, setLogs] = useState<ConfigLog[]>([]);
  const [rawLogXml, setRawLogXml] = useState('');

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
      id: crypto.randomUUID(),
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

  const handleFetchLogs = async () => {
    setIsExtracting(true);
    setExtractError(null);
    try {
      if (!webhookUrl) throw new Error("n8n Webhook URL is required.");
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ipAddress, 
          apiKey, 
          jobId,
          action: 'get_logs' 
        })
      });

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const data = await response.json();
      const xmlString = typeof data === 'string' ? data : data.raw || data.xml || JSON.stringify(data);
      setRawLogXml(xmlString);
      
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      const parsedLogs: ConfigLog[] = [];
      let match;
      
      while ((match = entryRegex.exec(xmlString)) !== null) {
        const content = match[1];
        const getTag = (tag: string) => {
          const m = content.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'));
          return m ? m[1] : '';
        };
        parsedLogs.push({
          time: getTag('receive_time'),
          admin: getTag('admin'),
          host: getTag('host') || ipAddress,
          client: getTag('client'),
          cmd: getTag('cmd'),
          result: getTag('result'),
          path: getTag('path'),
          before: getTag('before-change'),
          after: getTag('after-change'),
          sequence: getTag('seqno')
        });
      }
      setLogs(parsedLogs);
    } catch (err: any) {
      setExtractError(err.message || "Log fetch failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRunExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'monitor') {
      handleFetchLogs();
      return;
    }
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
              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded uppercase font-black tracking-widest">v2.5-MONITOR</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Enterprise Firewall Audit & Real-time Configuration Logging
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
              <span>Firewall Connector</span>
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
              {activeTab === 'monitor' && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log Job ID</label>
                  <input 
                    type="text" placeholder="e.g. 28" value={jobId} onChange={(e) => setJobId(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-blue-200 bg-blue-50/30 rounded-xl outline-none"
                  />
                </div>
              )}
              <button 
                type="submit" disabled={isExtracting}
                className="w-full py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (activeTab === 'monitor' ? <Terminal className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />)}
                <span>{activeTab === 'monitor' ? 'Stream Logs' : 'Fetch via n8n'}</span>
              </button>
            </form>
            {extractError && <p className="text-[9px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100">{extractError}</p>}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Snapshot History</h3>
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
                  <p className="text-[10px] font-black uppercase">No Data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Display */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Contextual Tab Bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-1 p-1 bg-slate-200/50 rounded-2xl">
              {(['security', 'nat', 'interfaces', 'monitor', 'raw'] as const).map(tab => (
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
            <div className="flex items-center space-x-6 text-[9px] font-black uppercase tracking-widest">
               <div className="flex items-center space-x-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm" /> <span className="text-emerald-700">Allow / Succeeded</span></div>
               <div className="flex items-center space-x-1.5"><div className="w-2 h-2 bg-red-500 rounded-full shadow-sm" /> <span className="text-red-700">Deny / Failed</span></div>
            </div>
          </div>

          {/* Work Area */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {activeTab === 'monitor' ? (
              <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden border-b border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 border-collapse table-fixed">
                    <thead className="bg-[#EBF5FB]">
                      <tr className="divide-x divide-slate-300">
                        <th className="w-32 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Receive Time</th>
                        <th className="w-28 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Administrator</th>
                        <th className="w-32 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Host</th>
                        <th className="w-20 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Client</th>
                        <th className="w-24 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Command</th>
                        <th className="w-24 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Result</th>
                        <th className="w-64 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Configuration Path</th>
                        <th className="w-64 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Before Change</th>
                        <th className="w-64 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">After Change</th>
                        <th className="w-32 px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-tight">Sequence Number</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100 text-[11px] font-sans">
                      {logs.length > 0 ? logs.map((log, idx) => (
                        <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FDFF]'} divide-x divide-slate-100 hover:bg-blue-50/50 transition-colors`}>
                          <td className="px-3 py-2 text-blue-600 font-medium underline cursor-pointer">{log.time}</td>
                          <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.admin}</td>
                          <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.host}</td>
                          <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.client}</td>
                          <td className="px-3 py-2 text-blue-600 underline cursor-pointer">{log.cmd}</td>
                          <td className={`px-3 py-2 font-medium ${log.result.toLowerCase() === 'succeeded' || log.result.toLowerCase() === 'submitted' ? 'text-blue-600 underline' : 'text-red-600'}`}>
                            {log.result}
                          </td>
                          <td className="px-3 py-2 text-slate-600 leading-tight">
                            <div className="max-h-16 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{log.path}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 leading-tight">
                            <div className="max-h-16 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{log.before}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 leading-tight">
                            <div className="max-h-16 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{log.after}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-400 font-mono truncate">{log.sequence}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={10} className="px-6 py-20 text-center text-slate-300 italic">
                            <div className="flex flex-col items-center">
                              <Monitor className="w-12 h-12 opacity-10 mb-4" />
                              <p className="text-sm font-bold uppercase tracking-widest">No Logs Captured</p>
                              <p className="text-[10px] mt-2">Enter Job ID {jobId} and Refresh Stream via Sidebar</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : viewMode === 'compare' ? (
              <div className="p-0">
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
        </div>
      </div>
    </div>
  );
};

export default ConfigExplorer;