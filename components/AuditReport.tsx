
import React, { useState } from 'react';
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

  // Use string comparison for safety if Enum fails
  const riskStr = String(finding?.risk || 'Low').toLowerCase();
  let badgeColor = 'bg-slate-400 text-white';
  
  if (riskStr === 'critical') badgeColor = 'bg-red-600 text-white';
  else if (riskStr === 'high') badgeColor = 'bg-orange-500 text-white';
  else if (riskStr === 'medium') badgeColor = 'bg-amber-400 text-slate-900';
  else if (riskStr === 'low') badgeColor = 'bg-blue-400 text-white';

  const isHighRisk = riskStr === 'critical' || riskStr === 'high';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isHighRisk ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            {isHighRisk ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{finding?.title || 'Unknown Finding'}</h4>
            <div className="flex items-center space-x-2">
               <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badgeColor}`}>
                {finding?.risk || 'Low'}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{finding?.category || 'General'}</span>
            </div>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-1 duration-200">
          <div className="h-px bg-slate-100 mb-4" />
          <div className="text-sm text-slate-600">
            <p className="mb-4">{finding?.description || 'No description provided.'}</p>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Recommendation</span>
              </div>
              <p className="text-slate-500 italic">{finding?.recommendation || 'No recommendation.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  // --- SAFETY LAYER: Ensure findings is NEVER undefined before calling .filter() or .map() ---
  const safeFindings = Array.isArray(report?.findings) ? report.findings : [];
  
  const score = typeof report?.overallScore === 'number' ? report.overallScore : 0;
  const deviceInfo = report?.deviceInfo || { hostname: 'Unknown', firmware: 'Unknown', uptime: 'Unknown' };

  // Generate chart data safely using the safeFindings array
  const getCount = (risk: string) => safeFindings.filter(f => String(f?.risk || '').toLowerCase() === risk.toLowerCase()).length;
  
  const riskData = [
    { name: 'Critical', value: getCount('critical'), color: '#dc2626' },
    { name: 'High', value: getCount('high'), color: '#f97316' },
    { name: 'Medium', value: getCount('medium'), color: '#fbbf24' },
    { name: 'Low', value: getCount('low'), color: '#60a5fa' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
            <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-800">{score}%</div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Health Score</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-3">
          <div className="flex items-center space-x-2 mb-2 font-bold text-slate-800">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3>AI Executive Summary</h3>
          </div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!showFullSummary ? 'line-clamp-2' : ''}`}>
            {report?.summary || "Audit complete."}
          </p>
          <button onClick={() => setShowFullSummary(!showFullSummary)} className="text-xs font-bold text-blue-600 mt-2">
            {showFullSummary ? 'Show Less' : 'Show More'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Findings ({safeFindings.length})</h3>
          </div>
          {safeFindings.length > 0 ? (
            safeFindings.map((f, idx) => <FindingItem key={idx} finding={f} />)
          ) : (
            <div className="bg-white p-12 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
              No findings identified.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 text-xs uppercase">Risk Breakdown</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value">
                    {riskData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[10px] p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-slate-500">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
             <h3 className="font-bold text-slate-800 text-xs uppercase">Device Details</h3>
             <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hostname</span>
                  <span className="font-mono">{deviceInfo.hostname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Firmware</span>
                  <span>{deviceInfo.firmware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Uptime</span>
                  <span>{deviceInfo.uptime}</span>
                </div>
             </div>
          </div>

          <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 text-sm">
            <span>Download Audit PDF</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;
