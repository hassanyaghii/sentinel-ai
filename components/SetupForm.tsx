
import React, { useState, useEffect } from 'react';
import { AuditConfig } from '../types';
import { Server, Key, Globe, ExternalLink, Send, Sparkles } from 'lucide-react';

interface SetupFormProps {
  onSubmit: (config: AuditConfig) => void;
  isLoading: boolean;
  initialValues: AuditConfig;
  onConfigChange?: (config: AuditConfig) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onSubmit, isLoading, initialValues, onConfigChange }) => {
  const [formData, setFormData] = useState<AuditConfig>(initialValues);

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(formData);
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fillDemoData = (e: React.MouseEvent) => {
    e.preventDefault();
    setFormData({
      ipAddress: '10.0.0.1',
      apiKey: 'SECURE_DEMO_TOKEN_8821',
      vendor: formData.vendor || 'fortinet',
      webhookUrl: 'https://n8n.example.com/webhook/test-audit'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700">Firewall IP Address</label>
        <button 
          onClick={fillDemoData}
          className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-bold"
        >
          <Sparkles className="w-3 h-3" />
          <span>Fill with Demo Data</span>
        </button>
      </div>
      <div className="relative">
        <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          required
          type="text"
          name="ipAddress"
          placeholder="e.g. 192.168.1.1"
          value={formData.ipAddress}
          onChange={handleChange}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-700"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">API Key / Token</label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            required
            type="password"
            name="apiKey"
            placeholder="Enter secure token"
            value={formData.apiKey}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Firewall Vendor</label>
        <select
          name="vendor"
          value={formData.vendor}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 appearance-none bg-white"
        >
          <option value="fortinet">Fortinet (FortiGate)</option>
          <option value="paloalto">Palo Alto Networks</option>
          <option value="cisco">Cisco (ASA/FTD)</option>
          <option value="generic">Generic / Other</option>
        </select>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
          <span>n8n Webhook URL</span>
          <span className="text-[10px] uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">Required</span>
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            required
            type="url"
            name="webhookUrl"
            placeholder="https://n8n.domain.com/webhook/..."
            value={formData.webhookUrl}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all ${
          isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
        }`}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            <span>Running Security Audit...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Initiate Analysis</span>
          </>
        )}
      </button>

      <p className="text-[11px] text-slate-400 text-center italic">
        Sentinel AI does not store your credentials. Data is passed directly to your n8n instance.
      </p>
    </form>
  );
};

export default SetupForm;
