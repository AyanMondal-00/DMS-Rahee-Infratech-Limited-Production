import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ShieldCheck, Search, Filter, RefreshCw, Building2 } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userEmailSearch, setUserEmailSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async (offset = 0, isAppend = false) => {
    try {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let queryParams = [
        `limit=20`,
        `offset=${offset}`
      ];
      if (userEmailSearch) queryParams.push(`user_email=${encodeURIComponent(userEmailSearch)}`);
      if (actionFilter) queryParams.push(`action=${encodeURIComponent(actionFilter)}`);

      const queryString = `?${queryParams.join('&')}`;
      const res = await api.get(`/audit-logs${queryString}`);

      if (res.data.success) {
        const fetchedLogs = res.data.auditLogs || [];
        if (isAppend) {
          setLogs(prev => [...prev, ...fetchedLogs]);
        } else {
          setLogs(fetchedLogs);
        }
        setHasMore(res.data.hasMore || false);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs(0, false);
  }, [userEmailSearch, actionFilter]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(logs.length, true);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Audit Trail Logs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable, append-only security audit log recording all user logins, document uploads, reviews, downloads, and administrative actions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={userEmailSearch}
            onChange={(e) => setUserEmailSearch(e.target.value)}
            placeholder="Search by user email ID..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-700"
        >
          <option value="">All Audit Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
          <option value="DOCUMENT_VIEWED">DOCUMENT_VIEWED</option>
          <option value="DOCUMENT_PREVIEWED">DOCUMENT_PREVIEWED</option>
          <option value="DOCUMENT_DOWNLOADED">DOCUMENT_DOWNLOADED</option>
          <option value="DOCUMENT_APPROVED_STAGE_1">DOCUMENT_APPROVED_STAGE_1</option>
          <option value="DOCUMENT_APPROVED_STAGE_2">DOCUMENT_APPROVED_STAGE_2</option>
          <option value="FINAL_APPROVED">FINAL_APPROVED</option>
          <option value="DOCUMENT_REJECTED">DOCUMENT_REJECTED</option>
          <option value="USER_CREATED">USER_CREATED</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading audit trail...
          </div>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Tenant Org</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Details / Comment</th>
                  <th className="py-3.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{log.user_name || 'System'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{log.user_email || 'N/A'}</p>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {log.organization_name || 'Global System'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded ${
                        log.action.includes('REJECTED') || log.action.includes('FAILED')
                          ? 'bg-rose-100 text-rose-800'
                          : log.action.includes('APPROVED') || log.action.includes('SUCCESS')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                      {log.comment}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Load More Pagination Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-900">{logs.length}</span> of <span className="font-bold text-slate-900">{totalCount}</span> audit records
              </p>

              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      <span>Loading next 20 logs...</span>
                    </>
                  ) : (
                    <span>Load More (Next 20)</span>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-sm">No Audit Logs Found</p>
            <p className="mt-1">No log entries match your active tenant scope or search filters.</p>
          </div>
        )}
      </div>

    </div>
  );
}
