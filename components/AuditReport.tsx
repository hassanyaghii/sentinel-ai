
import React, { useState, useMemo } from 'react';
import { FirewallReport, RiskLevel, SecurityFinding } from '../types';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface AuditReportProps {
  report: FirewallReport;
}

const FindingItem: React.FC<{ finding: SecurityFinding }> = ({ finding }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getRiskColor = (risk: RiskLevel | string) => {
    const r = typeof risk === 'string' ? risk.toLowerCase() : '';
    if (r === 'critical') return 'bg-red-600 text-white';
    if (r === 'high') return 'bg-orange-500 text-white';
    if (r === 'medium') return 'bg-amber-400 text-slate-900';
    if (r === 'low') return 'bg-blue-400 text-white';
    return 'bg-slate-400 text-white';
  };

  const isHighRisk = (risk: string) => ['critical', 'high'].includes(String(risk).toLowerCase());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isHighRisk(finding.risk) ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            {isHighRisk(finding.risk) ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{finding.title || 'Untitled Issue'}</h4>
            <div className="flex items-center space-x-2">
               <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getRiskColor(finding.risk)}`}>
                {finding.risk}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{finding.category || 'General'}</span>
            </div>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200">
          <div className="h-px bg-slate-100 mb-4" />
          <div className="text-sm text-slate-600">
            <p className="mb-4">{finding.description || 'No description provided.'}</p>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Recommended Mitigation</span>
              </div>
              <p className="text-slate-500 italic">{finding.recommendation || 'No recommendation provided.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  // ULTIMATE DEFENSE: Ensure findings is ALWAYS an array before doing anything.
  const findings = useMemo(() => {
    if (!report) return [];
    if (Array.isArray(report.findings)) return report.findings;
    // Handle cases where the AI might return an object instead of array
    if (report.findings && typeof report.findings === 'object') return [report.findings as any];
    return [];
  }, [report]);

  const score = report?.overallScore ?? 0;
  const deviceInfo = report?.deviceInfo || { hostname: 'Unknown', firmware: 'Unknown', uptime: 'Unknown' };

  // Safeguard risk data calculation
  const riskData = useMemo(() => {
    const getCount = (level: string) => 
      findings.filter(f => String(f.risk).toLowerCase() === level.toLowerCase()).length;

    return [
      { name: 'Critical', value: getCount('critical'), color: '#dc2626' },
      { name: 'High', value: getCount('high'), color: '#f97316' },
      { name: 'Medium', value: getCount('medium'), color: '#fbbf24' },
      { name: 'Low', value: getCount('low'), color: '#60a5fa' },
    ].filter(d => d.value > 0);
  }, [findings]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-1 flex flex-col items-center justify-center text-center">
          <div className="relative w-20 h-20 mb-2">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path className="stroke-slate-100 fill-none stroke-[3]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path 
                className={`fill-none stroke-[3] transition-all duration-1000 ${score > 70 ? 'stroke-green-500' : score > 40 ? 'stroke-amber-500' : 'stroke-red-500'}`}
                strokeDasharray={`${score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-800">{score}%</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Postures Score</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-3">
          <div className="flex items-center space-x-2 mb-2 text-slate-800">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold">Executive Summary</h3>
          </div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!showFullSummary ? 'line-clamp-2' : ''}`}>
            {report?.summary || "Analysis complete. Review findings below for specific configuration gaps and security risks identified by the agent."}
          </p>
          <button 
            onClick={() => setShowFullSummary(!showFullSummary)}
            className="text-xs font-bold text-blue-600 mt-2 hover:underline"
          >
            {showFullSummary ? 'Show Less' : 'Read Full Summary'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-1 px-1">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Analysis Findings</h3>
            <span className="text-xs text-slate-400 font-medium">{findings.length} Items</span>
          </div>
          {findings.length > 0 ? (
            findings.map((finding, idx) => (
              <FindingItem key={finding.id || idx} finding={finding} />
            ))
          ) : (
            <div className="bg-white p-12 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-green-300 mb-3" />
              <p className="text-sm font-bold text-slate-800">No Critical Risks Identified</p>
              <p className="text-xs text-slate-500 mt-1">The agent found no major policy violations in the provided config.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-tight">Risk Distribution</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: item.color }}></div>
                    <span className="text-slate-500">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
             <h3 className="font-bold text-slate-800 text-sm">Target Identity</h3>
             <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Hostname</span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{deviceInfo.hostname}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Firmware</span>
                  <span className="text-slate-700 font-medium">{deviceInfo.firmware}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Uptime</span>
                  <span className="text-slate-700 font-medium">{deviceInfo.uptime}</span>
                </div>
             </div>
          </div>

          <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-slate-800 transition-colors shadow-sm text-sm">
            <span>Export Full Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;
