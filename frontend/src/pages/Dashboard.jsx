import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  FileText, 
  FolderTree, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Activity, 
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  HardDrive,
  FileCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid } from 'recharts';

// Custom Tooltip for Pie Chart
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700/80 text-xs pointer-events-none z-50">
        <div className="flex items-center space-x-2">
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0" 
            style={{ backgroundColor: data.payload?.fill || '#3b82f6' }}
          />
          <span className="font-bold text-slate-200">{data.name}:</span>
          <span className="font-mono text-emerald-400 font-bold">{data.value} docs</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Bar Chart
const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const companyName = data.payload?.company_name || data.payload?.company || 'Company';
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700/80 text-xs pointer-events-none z-50">
        <p className="font-bold text-blue-400 mb-0.5">{companyName}</p>
        <p className="font-mono text-slate-200">
          <span className="text-slate-400">Total: </span>
          <span className="font-bold text-emerald-400">{data.value} files</span>
        </p>
      </div>
    );
  }
  return null;
};

// Format File Size Helper
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
};

// Color mapping helper for document/file types
const getFileTypeColor = (type, index) => {
  const t = (type || '').toUpperCase();
  if (t.includes('PDF')) return { bg: 'bg-rose-500', bar: '#f43f5e', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20' };
  if (t.includes('CAD') || t.includes('DWG') || t.includes('DXF')) return { bg: 'bg-cyan-500', bar: '#06b6d4', text: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' };
  if (t.includes('EXCEL') || t.includes('XLS') || t.includes('CSV')) return { bg: 'bg-emerald-500', bar: '#10b981', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
  if (t.includes('WORD') || t.includes('DOC')) return { bg: 'bg-blue-500', bar: '#3b82f6', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20' };
  if (t.includes('IMAGE') || t.includes('PNG') || t.includes('JPG') || t.includes('JPEG')) return { bg: 'bg-amber-500', bar: '#f59e0b', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
  if (t.includes('PPT') || t.includes('POWERPOINT')) return { bg: 'bg-purple-500', bar: '#a855f7', text: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20' };
  if (t.includes('ZIP') || t.includes('RAR') || t.includes('ARCHIVE')) return { bg: 'bg-indigo-500', bar: '#6366f1', text: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' };

  const fallbackColors = [
    { bg: 'bg-sky-500', bar: '#0ea5e9', text: 'text-sky-400', badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
    { bg: 'bg-violet-500', bar: '#8b5cf6', text: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
    { bg: 'bg-teal-500', bar: '#14b8a6', text: 'text-teal-400', badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20' },
    { bg: 'bg-pink-500', bar: '#ec4899', text: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
  ];
  return fallbackColors[index % fallbackColors.length];
};

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [charts, setCharts] = useState(null);
  const [storageBreakdown, setStorageBreakdown] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileStorageOpen, setMobileStorageOpen] = useState(false);

  const fetchDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get('/reports/dashboard');
      if (res.data.success) {
        setMetrics(res.data.metrics);
        setCharts(res.data.charts);
        setStorageBreakdown(res.data.storageBreakdown || res.data.charts?.storageBreakdown || res.data.charts?.categoryBreakdown || []);
        setRecentLogs(res.data.recentAuditLogs || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];
  const categoryData = charts?.categoryBreakdown || charts?.categoryChartData || [];
  const companyData = charts?.companyBreakdown || [];
  const storageItems = storageBreakdown.length > 0 ? storageBreakdown : (categoryData || []);

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userName = (user?.name || '').toLowerCase().trim();

  // Storage Card Visibility: Strictly restricted to Om Jha, Rahul Dey, and Rajib Ghosh ONLY
  const isStorageCardViewer = Boolean(
    // 1. Om Jha
    userEmail.startsWith('om.jha@') || userName.includes('om jha') || user?.id === 10 ||
    // 2. Rahul Dey
    userEmail === 'rahul.d@rahee.com' || userEmail.startsWith('rahul.d@') || userName.includes('rahul dey') || user?.id === 5 ||
    // 3. Rajib Ghosh (Super Admin)
    userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || userName.includes('rajib') || user?.is_super_admin || user?.role_id === 1 || user?.id === 11
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 pb-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center space-x-2 text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate">{user?.is_super_admin ? 'Global Super Administrator View' : user?.organization_name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight break-words">
            Welcome back, {user?.name}!
          </h1>
        </div>

        <button
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors border border-white/20 backdrop-blur-sm self-start sm:self-auto shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Live'}</span>
        </button>
      </div>

      {/* Metrics KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isStorageCardViewer ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        
        {/* 1. Total Documents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Total Documents</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{metrics?.totalDocuments || 0}</p>
          <p className="text-[11px] text-slate-400 mt-1 truncate">Uploaded &amp; accessible files</p>
        </div>

        {/* 2. Total Storage with Hover Pop-up Breakdown (Strictly visible only to Om Jha, Rahul Dey, Rajib Ghosh) */}
        {isStorageCardViewer && (
        <div 
          className="relative group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 min-w-0 cursor-pointer select-none"
          onClick={() => setMobileStorageOpen(prev => !prev)}
          tabIndex={0}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-xs font-bold uppercase tracking-wider truncate">Storage</span>
              <span className="flex h-2 w-2 relative" title="Storage Metrics Active">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
            </div>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors duration-200">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>

          <p className="text-2xl sm:text-3xl font-black text-slate-900 truncate">
            {formatFileSize(metrics?.totalStorageBytes)}
          </p>

          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span className="truncate">Database storage</span>
            <span className="inline-flex items-center text-violet-600 font-semibold text-[10px] bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100 group-hover:bg-violet-100 transition-colors">
              Breakdown ↗
            </span>
          </div>

          {/* Hover Pop-up Card (Document Type Breakdown) */}
          <div 
            className={`absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 z-50 transition-all duration-200 ease-out ${
              mobileStorageOpen 
                ? 'opacity-100 visible translate-y-0 pointer-events-auto' 
                : 'opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pop-up Arrow pointer */}
            <div className="absolute -top-1.5 left-8 sm:left-1/2 sm:-translate-x-1/2 w-3 h-3 bg-slate-900 border-t border-l border-slate-700 rotate-45"></div>

            <div className="relative z-10 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-violet-500/20 text-violet-400 rounded-lg border border-violet-500/30">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Storage Breakdown</h4>
                    <p className="text-[10px] text-slate-400">Size by document file type</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-black text-violet-300 block">
                    {formatFileSize(metrics?.totalStorageBytes)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {metrics?.totalDocuments || 0} files
                  </span>
                </div>
              </div>

              {/* Breakdown Rows */}
              {storageItems && storageItems.length > 0 ? (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {storageItems.map((item, idx) => {
                    const rawSize = Number(item.totalBytes ?? item.total_size ?? 0);
                    const totalBytes = Number(metrics?.totalStorageBytes || 0);
                    const percentage = totalBytes > 0 
                      ? Math.round((rawSize / totalBytes) * 100) 
                      : (item.percentage || 0);
                    const fileCount = Number(item.count || 0);
                    const color = getFileTypeColor(item.category, idx);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${color.bg}`} />
                            <span className="font-semibold text-slate-200 truncate">{item.category}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({fileCount} {fileCount === 1 ? 'doc' : 'docs'})
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0 font-mono text-[11px]">
                            <span className="text-slate-100 font-bold">{formatFileSize(rawSize)}</span>
                            <span className="text-violet-400 text-[10px] font-bold">({percentage}%)</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.max(percentage, 3)}%`,
                              backgroundColor: color.bar || '#8b5cf6' 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-400 italic">
                  No storage breakdown data recorded yet.
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Average size:</span>
                <span className="font-mono text-slate-200 font-bold">
                  {formatFileSize(metrics?.avgSizeBytes || (metrics?.totalStorageBytes && metrics?.totalDocuments ? Math.round(metrics.totalStorageBytes / metrics.totalDocuments) : 0))} / file
                </span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* 3. Total Folders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Total Folders</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FolderTree className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-indigo-900 truncate">{metrics?.totalFolders || 0}</p>
          <p className="text-[11px] text-slate-400 mt-1 truncate" title={user?.is_super_admin ? `RAHEE: ${metrics?.raheeFoldersCount || 0}, IRCON: ${metrics?.irconFoldersCount || 0}` : `${user?.organization_name || 'RAHEE'} directory folders`}>
            {user?.is_super_admin 
              ? `RAHEE: ${metrics?.raheeFoldersCount || 0} | IRCON: ${metrics?.irconFoldersCount || 0}`
              : `${user?.organization_name || (user?.organization_id === 2 ? 'IRCON' : 'RAHEE')} directory folders`}
          </p>
        </div>

        {/* 5. Tenant Scope */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-sm hover:shadow-md transition-shadow min-w-0">
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Tenant Scope</span>
            <div className="p-2 bg-indigo-100/70 text-indigo-700 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black text-indigo-950 truncate">
            {user?.is_super_admin ? 'RAHEE + IRCON' : user?.organization_name}
          </p>
          <p className="text-[11px] text-indigo-700 mt-1 truncate">Isolated Company Repositories</p>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">

        {/* 1. Document Format Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Document Type Distribution</span>
            </h3>

            {categoryData.length > 0 ? (
              <div className="w-full h-64 sm:h-72 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <Pie
                      data={categoryData}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="75%"
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
                No document format distribution data recorded yet.
              </div>
            )}
          </div>

          {categoryData.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-4 border-t border-slate-100 mt-2">
              {categoryData.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                  <span className="font-bold text-slate-700">{item.category}:</span>
                  <span className="text-slate-500 font-mono font-bold">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Documents by Organization (Multi-Tenant View) */}
        {user?.is_super_admin && companyData.length > 0 ? (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Documents by Company (Rahee vs Ircon)</span>
              </h3>

              <div className="w-full h-64 sm:h-72 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companyData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="company" 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fill: '#64748b', fontSize: 11 }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {companyData.map((entry, index) => (
                        <Cell 
                          key={`cell-bar-${index}`} 
                          fill={entry.company === 'RAHEE' ? '#3b82f6' : '#6366f1'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-4 border-t border-slate-100 mt-2">
              {companyData.map((c, idx) => (
                <div key={idx} className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: c.company === 'RAHEE' ? '#3b82f6' : '#6366f1' }}
                  ></span>
                  <span className="font-bold text-slate-700">{c.company_name || c.company}:</span>
                  <span className="text-slate-500 font-mono font-bold">{c.count} files</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Company Workspace Overview</span>
              </h3>

              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3">
                  <Building2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800">{user?.organization_name || 'Organization Workspace'}</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  All documents, folders, and audit events are strictly isolated to your organization workspace.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Tenant Isolation Active
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Quick Access:</span>
              <Link to="/documents" className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                Browse Repository &rarr;
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* Recent Audit Log Feed */}
      {hasPermission('view_audit_logs') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Recent System Audit Trail Activity</span>
            </h3>
            <Link to="/audit-logs" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 self-start sm:self-auto">
              <span>View All Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">{log.user_name || log.user_email}</span>
                      <span className="px-2 py-0.5 bg-slate-100 font-mono text-[10px] text-slate-700 rounded font-bold border border-slate-200">
                        {log.action}
                      </span>
                    </div>
                    {log.comment && (
                      <p className="text-slate-600 italic break-words line-clamp-2">{log.comment}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0 sm:ml-4 self-start sm:self-center">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No audit activity logged yet.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
