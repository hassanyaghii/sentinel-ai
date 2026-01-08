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

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case RiskLevel.CRITICAL: return 'bg-red-600 text-white';
      case RiskLevel.HIGH: return 'bg-orange-500 text-white';
      case RiskLevel.MEDIUM: return 'bg-amber-400 text-slate-900';
      case RiskLevel.LOW: return 'bg-blue-400 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            finding.risk === RiskLevel.CRITICAL || finding.risk === RiskLevel.HIGH
              ? 'bg-red-50 text-red-600'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {finding.risk === RiskLevel.CRITICAL || finding.risk === RiskLevel.HIGH
              ? <ShieldAlert className="w-5 h-5" />
              : <AlertTriangle className="w-5 h-5" />
            }
          </div>

          <div>
            <h4 className="font-bold text-slate-800">{finding.title}</h4>
            <div className="flex items-center space-x-2">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getRiskColor(finding.risk)}`}>
                {finding.risk}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {finding.category}
              </span>
            </div>
          </div>
        </div>

        {isOpen
          ? <ChevronUp className="w-5 h-5 text-slate-400" />
          : <ChevronDown className="w-5 h-5 text-slate-400" />
        }
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-0">
          <div className="h-px bg-slate-100 mb-4" />
          <p className="text-sm text-slate-600 mb-4">{finding.description}</p>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center space-x-2 text-slate-800 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Recommended Mitigation</span>
            </div>
            <p className="text-slate-500 italic text-sm">{finding.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditReport: React.FC<AuditReportProps> = ({ report }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  // 🔒 CRITICAL SAFETY GUARD
  const findings: SecurityFinding[] = Array.isArray(report?.findings)
    ? report.findings
    : [];

  const riskData = [
    { name: 'Critical', value: findings.filter(f => f.risk === RiskLevel.CRITICAL).length, color: '#dc2626' },
    { name: 'High', value: findings.filter(f => f.risk === RiskLevel.HIGH).length, color: '#f97316' },
    { name: 'Medium', value: findings.filter(f => f.risk === RiskLevel.MEDIUM).length, color: '#fbbf24' },
    { name: 'Low', value: findings.filter(f => f.risk === RiskLevel.LOW).length, color: '#60a5fa' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-2">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="stroke-slate-100 fill-none stroke-[3]"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
              />
              <path
                className={`fill-none stroke-[3] ${
                  report.overallScore > 70
                    ? 'stroke-green-500'
                    : report.overallScore > 40
                    ? 'stroke-amber-500'
                    : 'stroke-red-500'
                }`}
                strokeDasharray={`${report.overallScore}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{report.overallScore}%</span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase">Health Score</span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border md:col-span-3">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold">Executive Summary</h3>
          </div>
          <p className={`text-sm text-slate-600 ${!showFullSummary ? 'line-clamp-2' : ''}`}>
            {report.summary}
          </p>
          <button
            onClick={() => setShowFullSummary(!showFullSummary)}
            className="text-xs font-bold text-blue-600 mt-2 hover:underline"
          >
            {showFullSummary ? 'Show Less' : 'Read Full Summary'}
          </button>
        </div>
      </div>

      {/* Findings + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between">
            <h3 className="text-sm font-bold text-slate-500 uppercase">
              Analysis Findings
            </h3>
            <span className="text-xs text-slate-400">
              {findings.length} Issues Detected
            </span>
          </div>

          {findings.map((finding, index) => (
            <FindingItem key={finding.id || index} finding={finding} />
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <h3 className="font-bold text-sm mb-4">Risk Profile</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    dataKey="value"
                  >
                    {riskData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-slate-800 transition-colors">
            <span>Export Full Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditReport;