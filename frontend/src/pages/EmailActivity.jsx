import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Mail, RefreshCw, Eye, X, Send, Trash2, RotateCcw, ArchiveRestore, AlertCircle } from 'lucide-react';

export default function EmailActivity() {
  const { 
    emailLogs: liveContextEmailLogs,
    deleteEmailLog, 
    clearAllEmailLogs, 
    restoreEmailLog, 
    restoreAllEmailLogs, 
    permanentDeleteEmailLog, 
    emptyEmailTrash, 
    showConfirm 
  } = useNotification();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'trash'
  const [emailLogs, setEmailLogs] = useState([]);
  const [deletedLogs, setDeletedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const fetchAllLogs = async () => {
    try {
      setLoading(true);
      try {
        const resActive = await api.get('/notifications/emails');
        if (resActive.data.success) {
          setEmailLogs(resActive.data.emailLogs || []);
        }
      } catch (errActive) {
        console.error('Active emails fetch failed:', errActive);
      }

      try {
        const resDeleted = await api.get('/notifications/emails/deleted');
        if (resDeleted.data.success) {
          setDeletedLogs(resDeleted.data.emailLogs || []);
        }
      } catch (errDeleted) {
        console.error('Deleted emails fetch failed:', errDeleted);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllLogs();
  }, []);

  useEffect(() => {
    if (liveContextEmailLogs && liveContextEmailLogs.length > 0) {
      setEmailLogs(liveContextEmailLogs);
    }
  }, [liveContextEmailLogs]);

  // Delete single active email (Move to Trash)
  const handleDeleteSingle = async (id) => {
    const confirmed = await showConfirm({
      title: 'Move Email to Trash',
      message: 'Are you sure you want to move this email notification to trash? You can restore it later from the Trash tab.',
      confirmText: 'Move to Trash',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      if (deleteEmailLog) {
        await deleteEmailLog(id);
      } else {
        await api.delete(`/notifications/emails/${id}`);
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Delete email failed:', err);
    }
  };

  // Clear all active emails (Move all to Trash)
  const handleClearAll = async () => {
    const confirmed = await showConfirm({
      title: 'Clear Outbox',
      message: 'Are you sure you want to move all email notifications to trash? You can restore them anytime from the Trash tab.',
      confirmText: 'Move All to Trash',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      if (clearAllEmailLogs) {
        await clearAllEmailLogs();
      } else {
        await api.delete('/notifications/emails/clear-all');
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Clear all emails failed:', err);
    }
  };

  // Restore single deleted email
  const handleRestoreSingle = async (id) => {
    try {
      if (restoreEmailLog) {
        await restoreEmailLog(id);
      } else {
        await api.patch(`/notifications/emails/${id}/restore`);
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Restore email failed:', err);
    }
  };

  // Restore all deleted emails
  const handleRestoreAll = async () => {
    const confirmed = await showConfirm({
      title: 'Restore All Emails',
      message: 'Are you sure you want to restore all deleted email notifications back to your active outbox?',
      confirmText: 'Restore All',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      if (restoreAllEmailLogs) {
        await restoreAllEmailLogs();
      } else {
        await api.patch('/notifications/emails/restore-all');
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Restore all emails failed:', err);
    }
  };

  // Permanently delete single email from Trash
  const handlePermanentDeleteSingle = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Permanently',
      message: 'Are you sure you want to permanently delete this email record? This action cannot be undone.',
      confirmText: 'Delete Permanently',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      if (permanentDeleteEmailLog) {
        await permanentDeleteEmailLog(id);
      } else {
        await api.delete(`/notifications/emails/${id}/permanent`);
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Permanent delete failed:', err);
    }
  };

  // Empty entire Trash
  const handleEmptyTrash = async () => {
    const confirmed = await showConfirm({
      title: 'Empty Email Trash',
      message: 'Are you sure you want to permanently purge all deleted email notifications from the trash? This action cannot be undone.',
      confirmText: 'Empty Trash',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      if (emptyEmailTrash) {
        await emptyEmailTrash();
      } else {
        await api.delete('/notifications/emails/empty-trash');
      }
      await fetchAllLogs();
    } catch (err) {
      console.error('Empty trash failed:', err);
    }
  };

  const currentList = activeTab === 'active' ? emailLogs : deletedLogs;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Email Notifications Outbox</h1>
          
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchAllLogs}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {activeTab === 'active' && emailLogs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center space-x-2 px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl shadow-sm transition"
              title="Move all emails to trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Outbox</span>
            </button>
          )}

          {activeTab === 'trash' && deletedLogs.length > 0 && (
            <>
              <button
                onClick={handleRestoreAll}
                className="flex items-center space-x-2 px-3.5 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl shadow-sm transition"
                title="Restore all deleted emails"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore All</span>
              </button>

              <button
                onClick={handleEmptyTrash}
                className="flex items-center space-x-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                title="Permanently empty trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Trash</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Active Outbox</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'active' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {emailLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'trash'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Trash / Deleted</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'trash' ? 'bg-rose-800 text-rose-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {deletedLogs.length}
          </span>
        </button>
      </div>

      {/* Outbox Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading email logs...
          </div>
        ) : currentList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Recipient Email ID</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Document Title</th>
                  <th className="py-3.5 px-4">Delivery Status</th>
                  <th className="py-3.5 px-4">
                    {activeTab === 'trash' ? 'Deleted Date' : 'Timestamp'}
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentList.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {log.recipient_email}
                      <span className="text-[10px] text-slate-400 font-sans block">{log.recipient_name}</span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {log.subject}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 font-mono text-[10px] font-bold text-slate-700 rounded border border-slate-200">
                        {log.event_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      {log.document_title || 'N/A'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <Send className="w-3 h-3 mr-1" />
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(activeTab === 'trash' && log.deleted_at ? log.deleted_at : log.created_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Preview Email */}
                        <button
                          onClick={() => setSelectedEmail(log)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Email Content"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Active Tab: Delete / Move to Trash */}
                        {activeTab === 'active' && (
                          <button
                            onClick={() => handleDeleteSingle(log.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Trash Tab: Restore & Permanent Delete */}
                        {activeTab === 'trash' && (
                          <>
                            <button
                              onClick={() => handleRestoreSingle(log.id)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Restore Email Notification"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteSingle(log.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            {activeTab === 'active' ? (
              <>
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-800 text-sm">No Active Emails in Outbox</p>
                <p className="mt-1">Workflow actions like document uploads and reviews will generate email log entries here.</p>
              </>
            ) : (
              <>
                <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-800 text-sm">Email Trash is Empty</p>
                <p className="mt-1">Deleted email notification records will appear here for easy restoration.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* HTML Email Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{selectedEmail.subject}</h3>
                <p className="text-xs text-slate-300">To: <span className="font-mono text-blue-300">{selectedEmail.recipient_email}</span></p>
              </div>
              <button onClick={() => setSelectedEmail(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div 
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
