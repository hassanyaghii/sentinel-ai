
import React, { useState, useMemo } from 'react';
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
  report: any; 
}

const FindingItem: React.FC<{ finding: any }> = ({ finding }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Normalize risk field (Handle 'risk' from n8n JSON or 'risk_level' from MySQL)
  const rawRisk = finding?.risk || finding?.risk_level || finding?.riskLevel || finding?.severity || 'Low';
  const riskLabel = String(rawRisk);
  const riskKey = riskLabel.toLowerCase();
  
  let badgeClasses = 'bg-slate-400 text-white';
  if (riskKey === 'critical') badgeClasses = 'bg-red-600 text-white shadow-sm shadow-red-100';
  else if (riskKey === 'high') badgeClasses = 'bg-orange-500 text-white shadow-sm shadow-orange-100';
  else if (riskKey === 'medium') badgeClasses = 'bg-amber-400 text-slate-900 shadow-sm shadow-amber-100';
  else if (riskKey === 'low') badgeClasses = 'bg-blue-400 text-white shadow-sm shadow-blue-100';

  const isUrgent = riskKey === 'critical' || riskKey === 'high';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-300 transition-all hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between text-left group"
      >
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl transition-colors ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            {isUrgent ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors truncate">{finding?.title || 'System Finding'}</h4>
            <div className="flex items-center space-x-2 mt-1.5">
               <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeClasses}`}>
                {riskLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{finding?.category || 'General'}</span>
            </div>
          </div>
        </div>
        <div className="ml-4 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors shrink-0">
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
          <div className="h-px bg-slate-50 mb-5" />
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Analysis</span>
              <p className="text-sm text-slate-600 leading-relaxed">{finding?.description || 'No detailed analysis provided.'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs uppercase tracking-wider">Hardening Step</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed italic">{finding?.recommendation || 'No specific recommendation identified.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  const safeReport = useMemo(() => {
    // n8n returns an array [ { ... } ], so we unwrap it
    let base = Array.isArray(report) ? report[0] : report;
    base = base || {};
    
    return {
      score: Number(base?.overallScore ?? base?.overall_score ?? base?.score ?? 0),
      summary: String(base?.summary ?? base?.analysis ?? "Audit analysis is complete."),
      findings: Array.isArray(base?.findings) ? base.findings : [],
      device: base?.deviceInfo || base?.device_info || { hostname: base?.hostname || 'N/A', firmware: base?.device_firmware || 'N/A', uptime: 'N/A' }
    };
  }, [report]);

  const riskLevels = ['Critical', 'High', 'Medium', 'Low'];
  const riskData = useMemo(() => {
    return riskLevels.map(level => {
      const count = safeReport.findings.filter((f: any) => {
        const r = String(f?.risk || f?.risk_level || f?.riskLevel || f?.severity || '').toLowerCase();
        return r === level.toLowerCase();
      }).length;
      
      let color = '#94a3b8';
      if (level === 'Critical') color = '#dc2626';
      else if (level === 'High') color = '#f97316';
      else if (level === 'Medium') color = '#fbbf24';
      else if (level === 'Low') color = '#60a5fa';
      
      return { name: level, value: count, color };
    }).filter(d => d.value > 0);
  }, [safeReport.findings]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 md:col-span-1 flex flex-col items-center justify-center text-center">
          <div className="relative w-24 h-24 mb-3">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-50 stroke-[2.5]" />
              <circle 
                cx="18" cy="18" r="16" fill="none" 
                className={`stroke-[2.5] transition-all duration-1000 ${safeReport.score > 70 ? 'stroke-green-500' : safeReport.score > 40 ? 'stroke-amber-500' : 'stroke-red-500'}`}
                strokeDasharray={`${safeReport.score}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-black text-slate-900 text-2xl tracking-tighter">
              {safeReport.score}<span className="text-xs text-slate-300 ml-0.5">%</span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Health</span>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 md:col-span-3">
          <div className="flex items-center space-x-2 mb-3 font-black text-slate-800 text-xs uppercase tracking-widest">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3>AI Executive Analysis</h3>
          </div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!showFullSummary ? 'line-clamp-3' : ''}`}>
            {safeReport.summary}
          </p>
          <button onClick={() => setShowFullSummary(!showFullSummary)} className="text-[11px] font-bold text-blue-600 mt-4 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors inline-block">
            {showFullSummary ? 'Collapse Detailed View' : 'Read Full Security Impact'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-1 mb-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Detected Exposures ({safeReport.findings.length})</h3>
          </div>
          
          {safeReport.findings.length > 0 ? (
            safeReport.findings.map((f: any, idx: number) => <FindingItem key={idx} finding={f} />)
          ) : (
            <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-slate-100 text-center">
               <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
               </div>
               <h4 className="font-bold text-slate-900 mb-1">Clean Scan Results</h4>
               <p className="text-slate-400 text-sm">No critical vulnerabilities identified in current ruleset.</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-400 mb-6 text-[10px] uppercase tracking-widest">Risk Distribution</h3>
            <div className="h-48 mb-4">
              {riskData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} cx="50%" cy="50%" innerRadius={55} outerRadius={70} paddingAngle={8} dataKey="value">
                      {riskData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 italic">
                   <ShieldAlert className="w-8 h-8 opacity-10 mb-2" />
                   <span className="text-[10px]">No distribution data</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[11px] p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-slate-600 font-bold">{item.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white space-y-5 border border-slate-800 shadow-xl">
             <h3 className="font-black text-blue-400 text-[10px] uppercase tracking-widest">Target Environment</h3>
             <div className="space-y-4 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400 font-medium">Hostname</span>
                  <span className="font-mono text-blue-100 font-bold">{safeReport.device.hostname || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400 font-medium">OS Version</span>
                  <span className="text-blue-100 font-bold">{safeReport.device.firmware || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Uptime</span>
                  <span className="text-blue-100 font-bold">{safeReport.device.uptime || 'N/A'}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;
