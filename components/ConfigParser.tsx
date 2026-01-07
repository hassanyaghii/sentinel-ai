
import React, { useState, useMemo } from 'react';
import { FileCode, Search, Download, Trash2, Filter, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { parseConfig } from '../lib/parsers';
import { ParsedRule } from '../types';

const ConfigParser: React.FC = () => {
  const [configText, setConfigText] = useState('');
  const [vendor, setVendor] = useState<'cisco' | 'paloalto' | 'iptables'>('cisco');
  const [searchTerm, setSearchTerm] = useState('');

  const parsedRules = useMemo(() => {
    return parseConfig(vendor, configText);
  }, [vendor, configText]);

  const filteredRules = useMemo(() => {
    return parsedRules.filter(rule => 
      rule.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rule.name && rule.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [parsedRules, searchTerm]);

  const loadSample = () => {
    switch (vendor) {
      case 'cisco':
        setConfigText(`access-list OUTSIDE extended permit tcp any host 1.1.1.1 eq 443
access-list OUTSIDE extended deny ip any any
access-list INSIDE extended permit ip 192.168.1.0 255.255.255.0 any
access-list DMZ extended permit tcp 172.16.0.0 255.255.0.0 host 10.0.0.5 eq 80`);
        break;
      case 'paloalto':
        setConfigText(`set rulebase security rules Web-Traffic source any destination [ 1.1.1.1 ] service HTTPS action allow
set rulebase security rules Block-All source any destination any service any action deny
set rulebase security rules User-Access source [ 192.168.50.0 ] destination [ 10.10.10.20 ] service TCP-445 action allow
set rulebase security rules Guest-WiFi source [ Guest-Net ] destination any service any action allow
set rulebase security rules DNS-Queries source [ Internal-LAN ] destination [ 8.8.8.8 ] service UDP-53 action allow`);
        break;
      case 'iptables':
        setConfigText(`-A INPUT -p tcp -s 192.168.1.50 -d 0.0.0.0 --dport 22 -j ACCEPT
-A INPUT -p icmp -j DROP
-A FORWARD -s 10.0.0.0/24 -d 8.8.8.8 -p udp --dport 53 -j ACCEPT`);
        break;
    }
  };

  const getActionBadge = (action: string) => {
    const isPermit = ['permit', 'allow', 'accept'].includes(action.toLowerCase());
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
        isPermit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Rulebase Parser</h2>
              <p className="text-sm text-slate-500">Locally parse configuration files to audit structured data</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="cisco">Cisco ASA</option>
              <option value="paloalto">Palo Alto (Set Commands)</option>
              <option value="iptables">Linux iptables</option>
            </select>
            <button 
              onClick={loadSample}
              className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center space-x-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Load Sample</span>
            </button>
            <button 
              onClick={() => setConfigText('')}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Clear text"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Input Configuration</label>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder={`Paste your ${vendor.toUpperCase()} config here...`}
              className="w-full h-[400px] p-4 font-mono text-sm bg-slate-900 text-blue-100 rounded-xl border border-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase">Parsed Results ({filteredRules.length})</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="h-[400px] overflow-y-auto rounded-xl border border-slate-100 bg-white">
              {filteredRules.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Source</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Destination</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Service</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-4 py-3">{getActionBadge(rule.action)}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{rule.source}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{rule.destination}</td>
                        <td className="px-4 py-3 text-slate-50">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mr-1 text-slate-600">
                            {rule.protocol}
                          </span>
                          <span className="text-slate-500">{rule.port}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-8">
                  <Filter className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium">No rules detected. Try changing vendor or pasting content.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl flex items-start space-x-4">
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-900">Security Note</h4>
            <p className="text-sm text-amber-800 mt-1">
              This parser runs entirely in your browser. No configuration data is sent to external servers unless you explicitly click "Send to AI Audit".
            </p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex items-start space-x-4">
          <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-blue-900">Structured Analysis</h4>
            <p className="text-sm text-blue-800 mt-1">
              Parsing raw text into a table allows the Sentinel AI to focus on logical gaps rather than formatting syntax.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigParser;
