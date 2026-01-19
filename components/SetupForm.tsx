
import React, { useState, useEffect } from 'react';
import { AuditConfig } from '../types';
import { Server, Key, Globe, Send, Sparkles } from 'lucide-react';

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
      ipAddress: '10.1.20.5',
      apiKey: 'S3CUR3_API_K3Y_771',
      vendor: 'paloalto',
      webhookUrl: formData.webhookUrl || 'http://localhost:3001/api/audit'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700">Firewall IP</label>
        <button 
          onClick={fillDemoData}
          className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1"
        >
          <Sparkles className="w-3 h-3" />
          <span>Load Defaults</span>
        </button>
      </div>
      <div className="relative">
        <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          required
          type="text"
          name="ipAddress"
          placeholder="Firewall Address"
          value={formData.ipAddress}
          onChange={handleChange}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-slate-700"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Firewall Credentials</label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            required
            type="password"
            name="apiKey"
            placeholder="API Key"
            value={formData.apiKey}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-slate-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Architecture</label>
        <select
          name="vendor"
          value={formData.vendor}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none text-slate-700 bg-white"
        >
          <option value="paloalto">Palo Alto Networks</option>
          <option value="fortinet">Fortinet (FortiGate)</option>
          <option value="cisco">Cisco (ASA)</option>
          <option value="generic">Generic Firewall</option>
        </select>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <label className="block text-sm font-semibold text-slate-700 mb-1">Server API Endpoint</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            required
            type="url"
            name="webhookUrl"
            placeholder="http://localhost:3001/api/audit"
            value={formData.webhookUrl}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-blue-600 font-medium"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all ${
          isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading ? 'Processing Audit...' : 'Run Analysis'}
      </button>

      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
        Secure Local Database Storage Active
      </p>
    </form>
  );
};

export default SetupForm;
