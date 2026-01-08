import React, { useState } from 'react';
import { FirewallReport, RiskLevel, SecurityFinding } from '../types';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface AuditReportProps {
  report: FirewallReport | null;
}

const FindingItem: React.FC<{ finding: SecurityFinding }> = ({ finding }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to handle case-insensitive risk matching
  const getRiskDetails = (risk: string) => {
    const r = String(risk || '').toUpperCase();
    switch (r) {
      case 'CRITICAL': return { color: 'bg-red-600 text-white', icon: <ShieldAlert className="w-5 h-5" />, bg: 'bg-red-50 text-red-600' };
      case 'HIGH': return { color: 'bg-orange-500 text-white', icon: <ShieldAlert className="w-5 h-5" />, bg: 'bg-red-50 text-red-600' };
      case 'MEDIUM': return { color: 'bg-amber-400 text-slate-900', icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-600' };
      case 'LOW': return { color: 'bg-blue-400 text-white', icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-blue-50 text-blue-600' };
      default: return { color: 'bg-slate-400 text-white', icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-slate-50 text-slate-600' };
    }
  };

  const style = getRiskDetails(finding.risk);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-3 transition-all hover:border-slate-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50"
      >
        <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-lg ${style.bg}`}>
            {style.icon}
          </div>

          <div>
            <h4 className="font-bold text-slate-800 leading-tight">{finding.title || "Untitled Finding"}</h4>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${style.color}`}>
                {finding.risk || 'UNKNOWN'}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                {finding.category || 'General'}
              </span>
            </div>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200">
          <div className="h-px bg-slate-100 mb-4" />
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Issue Description</span>
              <p className="text-sm text-slate-600 leading-relaxed">{finding.description}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs uppercase tracking-tight">AI Recommended Mitigation</span>
              </div>
              <p className="text-slate-600 text-sm italic leading-relaxed">"{finding.recommendation}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  // 🛡️ GUARD: If report is null or undefined, show nothing (prevents white screen)
  if (!report) return null;

  // 🛡️ DATA SANITY: Ensure findings is always an array
  const findingsList = Array.isArray(report.findings) ? report.findings : [];

  // Helper to count risks safely
  const countRisk = (level: string) => {
    return findingsList.filter(f => String(f?.risk || '').toUpperCase() === level).length;
  };

  const riskData = [
    { name: 'Critical', value: countRisk('CRITICAL'), color: '#dc2626' },
    { name: 'High', value: countRisk('HIGH'), color: '#f97316' },
    { name: 'Medium', value: countRisk('MEDIUM'), color: '#fbbf24' },
    { name: 'Low', value: countRisk('LOW'), color: '#60a5fa' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Header: Device Info & Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 mb-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100" strokeWidth="3" />
              <circle 
                cx="18" cy="18" r="16" fill="none" 
                className={`transition-all duration-1000 ${
                  report.overallScore > 70 ? 'stroke-green-500' : report.overallScore > 40 ? 'stroke-amber-500' : 'stroke-red-500'
                }`}
                strokeWidth="3"
                strokeDasharray={`${report.overallScore}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-800">{report.overallScore}%</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Health</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-800">Executive Summary</h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Host</span>
              <span className="text-xs font-mono font-bold text-slate-700">{report.deviceInfo?.hostname || 'Unknown'}</span>
            </div>
          </div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!showFullSummary ? 'line-clamp-3' : ''}`}>
            {report.summary || "Generating security summary..."}
          </p>
          <button 
            onClick={() => setShowFullSummary(!showFullSummary)} 
            className="text-xs font-bold text-blue-600 mt-3 hover:text-blue-800 flex items-center gap-1"
          >
            {showFullSummary ? 'Show Less' : 'Read Full Analysis'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Findings List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detailed Findings</h3>
            <span className="text-xs font-bold text-slate-500">{findingsList.length} Issues Identified</span>
          </div>

          {findingsList.length > 0 ? (
            findingsList.map((finding, idx) => (
              <FindingItem key={finding.id || idx} finding={finding} />
            ))
          ) : (
            <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center">
              <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No security vulnerabilities detected.</p>
            </div>
          )}
        </div>

        {/* Risk Profile Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-8">
            <h3 className="font-bold text-sm text-slate-800 mb-6 flex items-center gap-2">
              Risk Distribution
            </h3>
            <div className="h-48 w-full">
              {riskData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={riskData} 
                      cx="50%" cy="50%" 
                      innerRadius={55} 
                      outerRadius={75} 
                      dataKey="value"
                      paddingAngle={4}
                    >
                      {riskData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  Not enough data for profile
                </div>
              )}
            </div>
            
            <div className="mt-6 space-y-3">
              {riskData.map((r, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-xs font-medium text-slate-600">{r.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;