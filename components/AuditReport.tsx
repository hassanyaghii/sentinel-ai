import React, { useState } from 'react';
import { FirewallReport, SecurityFinding } from '../types';
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
  // We use 'any' here to safely accept the nested array structure from n8n
  report: FirewallReport | any; 
}

const FindingItem: React.FC<{ finding: SecurityFinding }> = ({ finding }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Normalize risk strings (e.g., "Medium" -> "MEDIUM")
  const risk = String(finding.risk || '').toUpperCase();
  
  const getRiskStyles = () => {
    if (risk === 'CRITICAL' || risk === 'HIGH') 
      return 'bg-red-50 text-red-600 border-red-100';
    if (risk === 'MEDIUM') 
      return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-3">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-lg border ${getRiskStyles()}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h4 className="font-bold text-slate-800">{finding.title || "Untitled Finding"}</h4>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{finding.risk}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">• {finding.category}</span>
            </div>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200">
          <div className="h-px bg-slate-100 mb-4" />
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">{finding.description}</p>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <div className="flex items-center space-x-2 font-bold text-slate-800 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs uppercase tracking-tight">AI Recommendation</span>
            </div>
            <p className="text-sm text-slate-500 italic">"{finding.recommendation}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  // 🛡️ THE FIX: Unwrap the n8n array [ {data} ] if it exists
  const data = Array.isArray(report) ? report[0] : report;

  // If data is missing entirely, return nothing instead of crashing
  if (!data) return null;

  // Safely ensure findings is an array before filtering
  const findings = Array.isArray(data.findings) ? data.findings : [];

  const countRisk = (level: string) => 
    findings.filter((f: any) => String(f?.risk || '').toUpperCase() === level).length;

  const riskData = [
    { name: 'Critical', value: countRisk('CRITICAL'), color: '#dc2626' },
    { name: 'High', value: countRisk('HIGH'), color: '#f97316' },
    { name: 'Medium', value: countRisk('MEDIUM'), color: '#fbbf24' },
    { name: 'Low', value: countRisk('LOW'), color: '#60a5fa' },
  ].filter(d => d.value > 0);

  const score = Number(data.overallScore) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Top Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-2 flex items-center justify-center border-4 border-slate-100 rounded-full">
             <span className="text-2xl font-black text-slate-800">{score}%</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Score</span>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-3">
          <div className="flex items-center space-x-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800">Executive Summary</h3>
          </div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!showFullSummary ? 'line-clamp-3' : ''}`}>
            {data.summary || "No summary provided."}
          </p>
          <button 
            onClick={() => setShowFullSummary(!showFullSummary)} 
            className="text-xs font-bold text-blue-600 mt-2 hover:underline"
          >
            {showFullSummary ? 'Show Less' : 'Read Full Analysis'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Findings List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Audit Findings</h3>
            <span className="text-xs font-bold text-slate-500">{findings.length} Items</span>
          </div>
          {findings.length > 0 ? (
            findings.map((f: any, i: number) => <FindingItem key={i} finding={f} />)
          ) : (
            <div className="p-10 text-center bg-white border border-dashed rounded-xl text-slate-400">
              No vulnerabilities found.
            </div>
          )}
        </div>

        {/* Sidebar Charts */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-8">
            <h3 className="font-bold text-sm text-slate-800 mb-6 flex items-center gap-2">
              Risk Profile
            </h3>
            <div className="h-40">
              {riskData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={riskData} 
                      cx="50%" cy="50%" 
                      innerRadius={45} 
                      outerRadius={60} 
                      dataKey="value" 
                      paddingAngle={5}
                    >
                      {riskData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  Not enough data
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
               {riskData.map((r, i) => (
                 <div key={i} className="flex justify-between items-center text-xs">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                     <span className="text-slate-500">{r.name}</span>
                   </div>
                   <span className="font-bold text-slate-800">{r.value}</span>
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