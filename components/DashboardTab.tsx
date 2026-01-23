
import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  ShieldCheck,
  AlertCircle, 
  Server, 
  Calendar,
  MousePointer2
} from 'lucide-react';

interface DashboardTabProps {
  reports: any[];
}

const DashboardTab: React.FC<DashboardTabProps> = ({ reports }) => {
  // Group unique devices by Hostname + IP
  const devices = useMemo(() => {
    const map = new Map<string, { hostname: string, ip: string }>();
    reports.forEach(r => {
      const key = `${r.hostname || 'Unknown'}_${r.ip_address}`;
      if (!map.has(key)) {
        map.set(key, { hostname: r.hostname || 'Unknown', ip: r.ip_address });
      }
    });
    return Array.from(map.values());
  }, [reports]);

  const [selectedDevice, setSelectedDevice] = useState<{ hostname: string, ip: string } | null>(
    devices.length > 0 ? devices[0] : null
  );

  const deviceData = useMemo(() => {
    if (!selectedDevice) return [];
    return reports
      .filter(r => (r.hostname || 'Unknown') === selectedDevice.hostname && r.ip_address === selectedDevice.ip)
      .map(r => ({
        date: new Date(r.created_at).toLocaleDateString(),
        fullDate: new Date(r.created_at).toLocaleString(),
        score: r.overall_score || 0,
        id: r.id
      }))
      .reverse(); // Time ordered
  }, [selectedDevice, reports]);

  const stats = useMemo(() => {
    if (deviceData.length === 0) return { best: 0, latest: 0, trend: 'stable' };
    const latest = deviceData[deviceData.length - 1].score;
    const best = Math.max(...deviceData.map(d => d.score));
    let trend = 'stable';
    if (deviceData.length > 1) {
      const prev = deviceData[deviceData.length - 2].score;
      if (latest > prev) trend = 'up';
      else if (latest < prev) trend = 'down';
    }
    return { best, latest, trend };
  }, [deviceData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-white">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{payload[0].payload.fullDate}</p>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xl font-black">{payload[0].value}%</span>
          </div>
          <p className="text-[9px] font-bold text-slate-500 mt-1">Audit Record: {payload[0].payload.id}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* HEADER & SELECTOR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><Activity className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Security Posture Trends</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" /> Time-Series Historical Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Target Device:</span>
          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            value={selectedDevice ? `${selectedDevice.hostname}_${selectedDevice.ip}` : ''}
            onChange={(e) => {
              const [h, i] = e.target.value.split('_');
              setSelectedDevice({ hostname: h, ip: i });
            }}
          >
            {devices.map(d => (
              <option key={`${d.hostname}_${d.ip}`} value={`${d.hostname}_${d.ip}`}>
                {d.hostname} ({d.ip})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Shield className="w-16 h-16" /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Audit Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-4xl font-black tracking-tighter ${stats.latest > 70 ? 'text-green-600' : stats.latest > 40 ? 'text-amber-500' : 'text-red-600'}`}>
              {stats.latest}%
            </span>
            {stats.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500" />}
            {stats.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Baseline comparison active</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck className="w-16 h-16 text-emerald-500" /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Best Audit Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-black text-slate-900 tracking-tighter">{stats.best}%</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Peak security posture achieved</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl relative overflow-hidden group border border-slate-800">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Server className="w-16 h-16 text-blue-400" /></div>
           <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">Active Target</span>
           <div className="mt-2">
              <h4 className="text-white font-black text-xl truncate">{selectedDevice?.hostname}</h4>
              <p className="text-blue-200/50 font-mono text-xs font-bold">{selectedDevice?.ip}</p>
           </div>
           <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-black text-slate-500 uppercase">Monitoring Active</span>
           </div>
        </div>
      </div>

      {/* CHART SECTION */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Score over Time</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Correlation of configuration hardening audits</p>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-blue-600 rounded"></div>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Overall Score</span>
              </div>
           </div>
        </div>

        <div className="h-[400px] w-full">
          {deviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deviceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#2563eb" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-200">
               <AlertCircle className="w-16 h-16 mb-4 opacity-10" />
               <p className="text-xs font-black uppercase tracking-widest">Insufficient data for trend mapping</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
         <MousePointer2 className="w-6 h-6 text-blue-600 mt-1" />
         <div>
            <h4 className="font-black text-blue-900 text-sm uppercase tracking-widest">Interactive Audit Intelligence</h4>
            <p className="text-xs text-blue-800/70 leading-relaxed mt-1 font-medium">
              The chart above visualizes the stability of your firewall configuration. Dips in the score often correlate with unauthorized rule additions or management protocol changes. Hover over any node to see the specific audit record ID and timestamp from the MySQL history.
            </p>
         </div>
      </div>
    </div>
  );
};

export default DashboardTab;
