
import React, { useState, useEffect } from 'react';
import { AuditConfig } from '../types';
import { Server, Key, Send, Sparkles } from 'lucide-react';

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
    setFormData(prev => ({
      ...prev,
      ipAddress: '10.1.20.5',
      apiKey: 'S3CUR3_API_K3Y_771',
      vendor: 'paloalto'
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center space-x-2">
          <Server className="w-4 h-4 text-blue-600" />
          <span>Firewall Target</span>
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Device Address</label>
            <button 
              onClick={fillDemoData}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-black flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>DEFAULT</span>
            </button>
          </div>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              required
              type="text"
              name="ipAddress"
              placeholder="0.0.0.0"
              value={formData.ipAddress}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none text-slate-700 focus:ring-2 focus:ring-blue-500/20 font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Management API Key</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              required
              type="password"
              name="apiKey"
              placeholder="••••••••••••••••"
              value={formData.apiKey}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none text-slate-700 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Platform</label>
          <select
            name="vendor"
            value={formData.vendor}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none text-slate-800 bg-white font-bold text-sm focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="paloalto">Palo Alto PAN-OS</option>
            <option value="fortinet">Fortinet FortiGate</option>
            <option value="cisco">Cisco Systems ASA</option>
            <option value="generic">Standard Configuration</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-xl font-black text-sm text-white shadow-xl transition-all flex items-center justify-center space-x-3 uppercase tracking-widest ${
            isLoading ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-black active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Initiate Audit</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default SetupForm;
