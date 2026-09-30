import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { 
  Trash2, 
  RotateCcw, 
  Folder, 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  Building2, 
  HardDrive, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  FolderOpen,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  Clock,
  User as UserIcon,
  HelpCircle
} from 'lucide-react';

export default function RecycleBin() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useNotification();
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ totalDeleted: 0, totalFolders: 0, totalDocuments: 0, totalBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'FOLDERS' | 'DOCUMENTS'
  const [searchQuery, setSearchQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const isSuperAdmin = !!user?.is_super_admin || user?.role_id === 1 || user?.email === 'rajib.g@rahee.com';

  const fetchRecycleBin = async () => {
    try {
      setLoading(true);
      const res = await api.get('/recycle-bin/items');
      if (res.data.success) {
        setFolders(res.data.folders || []);
        setDocuments(res.data.documents || []);
        setStats(res.data.stats || { totalDeleted: 0, totalFolders: 0, totalDocuments: 0, totalBytes: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch recycle bin:', err);
      showFeedback('error', err.response?.data?.message || 'Failed to load Recycle Bin items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchRecycleBin();
    }
  }, [isSuperAdmin]);

  const showFeedback = (type, text) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 6000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Restore single folder
  const handleRestoreFolder = async (folder) => {
    const confirmed = await showConfirm({
      title: 'Restore Folder',
      message: `Restore folder "${folder.name}" and all its contents back to its original location?`,
      confirmText: 'Restore Folder',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.post(`/recycle-bin/restore/folder/${folder.id}`);
      if (res.data.success) {
        showFeedback('success', `Folder "${folder.name}" successfully restored to original directory path.`);
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to restore folder: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Restore single document
  const handleRestoreDocument = async (doc) => {
    const confirmed = await showConfirm({
      title: 'Restore File',
      message: `Restore file "${doc.title}" back to "${doc.target_folder_path || 'original folder'}"?`,
      confirmText: 'Restore File',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.post(`/recycle-bin/restore/document/${doc.id}`);
      if (res.data.success) {
        showFeedback('success', `File "${doc.title}" successfully restored back to its original location.`);
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to restore file: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Restore all items
  const handleRestoreAll = async () => {
    const confirmed = await showConfirm({
      title: 'Restore All Items',
      message: `Are you sure you want to restore ALL (${stats.totalDeleted}) deleted folders and files back to their original locations?`,
      confirmText: 'Restore All Items',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.post('/recycle-bin/restore-all');
      if (res.data.success) {
        showFeedback('success', 'All folders and files have been successfully restored to their original locations.');
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to restore all items: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Permanently delete single folder
  const handlePermanentDeleteFolder = async (folder) => {
    const confirmed = await showConfirm({
      title: 'Permanently Delete Folder',
      message: `PERMANENT DELETE WARNING:\n\nAre you sure you want to PERMANENTLY delete folder "${folder.name}"? This action cannot be undone.`,
      confirmText: 'Permanently Purge',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.delete(`/recycle-bin/permanent/folder/${folder.id}`);
      if (res.data.success) {
        showFeedback('success', `Folder "${folder.name}" has been permanently purged.`);
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to permanently delete folder: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Permanently delete single document
  const handlePermanentDeleteDocument = async (doc) => {
    const confirmed = await showConfirm({
      title: 'Permanently Delete File',
      message: `PERMANENT DELETE WARNING:\n\nAre you sure you want to PERMANENTLY delete file "${doc.title}"? The underlying files will be permanently erased from disk.`,
      confirmText: 'Permanently Purge File',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.delete(`/recycle-bin/permanent/document/${doc.id}`);
      if (res.data.success) {
        showFeedback('success', `File "${doc.title}" has been permanently purged from disk.`);
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to permanently delete file: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Empty entire Recycle Bin
  const handleEmptyRecycleBin = async () => {
    const confirmed = await showConfirm({
      title: 'Empty Recycle Bin',
      message: `CRITICAL ACTION:\n\nThis will PERMANENTLY delete ALL ${stats.totalDeleted} folders and files in the Recycle Bin and purge their storage files from disk. This cannot be undone.`,
      confirmText: 'Yes, Empty Recycle Bin',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await api.delete('/recycle-bin/empty');
      if (res.data.success) {
        showFeedback('success', 'Recycle Bin has been completely emptied.');
        fetchRecycleBin();
      }
    } catch (err) {
      showFeedback('error', 'Failed to empty recycle bin: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for document format icon
  const getFileIcon = (docType) => {
    const type = (docType || '').toUpperCase();
    if (type === 'PDF') {
      return <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-200"><FileText className="w-5 h-5" /></div>;
    }
    if (type === 'WORD') {
      return <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200"><FileText className="w-5 h-5" /></div>;
    }
    if (type === 'EXCEL') {
      return <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200"><FileSpreadsheet className="w-5 h-5" /></div>;
    }
    if (type === 'POWERPOINT') {
      return <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200"><Layers className="w-5 h-5" /></div>;
    }
    if (type === 'IMAGE') {
      return <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-200"><ImageIcon className="w-5 h-5" /></div>;
    }
    return <div className="p-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200"><FileCode className="w-5 h-5" /></div>;
  };

  // Combine and filter items
  const combinedItems = useMemo(() => {
    let list = [];
    if (activeTab === 'ALL' || activeTab === 'FOLDERS') {
      list.push(...folders);
    }
    if (activeTab === 'ALL' || activeTab === 'DOCUMENTS') {
      list.push(...documents);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const name = (item.name || item.title || '').toLowerCase();
        const fullPath = (item.full_path || '').toLowerCase();
        const deletedBy = (item.deleted_by_name || item.deleted_by_email || '').toLowerCase();
        return name.includes(q) || fullPath.includes(q) || deletedBy.includes(q);
      });
    }

    // Apply organization filter
    if (orgFilter) {
      list = list.filter(item => String(item.organization_id) === String(orgFilter));
    }

    // Sort by deleted_at descending
    list.sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0));

    return list;
  }, [folders, documents, activeTab, searchQuery, orgFilter]);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          The Recycle Bin and Recovery Vault is strictly restricted to Super Administrator (Rajib Ghosh).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-2 z-10">
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Recycle Bin &amp; Restoration Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 z-10">
          <button
            onClick={fetchRecycleBin}
            disabled={loading || actionLoading}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {stats.totalDeleted > 0 && (
            <>
              <button
                onClick={handleRestoreAll}
                disabled={loading || actionLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/40 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore All Items</span>
              </button>

              <button
                onClick={handleEmptyRecycleBin}
                disabled={loading || actionLoading}
                className="flex items-center space-x-2 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Bin</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Alert Toast */}
      {feedbackMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-sm transition animate-in fade-in slide-in-from-top-2 ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center space-x-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total In Bin</div>
            <div className="text-xl font-black text-slate-800">{stats.totalDeleted}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deleted Folders</div>
            <div className="text-xl font-black text-slate-800">{stats.totalFolders}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deleted Files</div>
            <div className="text-xl font-black text-slate-800">{stats.totalDocuments}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recoverable Storage</div>
            <div className="text-xl font-black text-slate-800">{formatFileSize(stats.totalBytes)}</div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Items</span>
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px]">{stats.totalDeleted}</span>
          </button>

          <button
            onClick={() => setActiveTab('FOLDERS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'FOLDERS'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-amber-600" />
            <span>Folders</span>
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px]">{stats.totalFolders}</span>
          </button>

          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'DOCUMENTS'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Files</span>
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px]">{stats.totalDocuments}</span>
          </button>
        </div>

        {/* Search & Organization Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, path, or user..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="">All Companies</option>
            <option value="1">Rahee Infratech Limited</option>
            <option value="2">Ircon International Limited</option>
          </select>
        </div>
      </div>

      {/* Items List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <div>Loading Recycle Bin inventory...</div>
          </div>
        ) : combinedItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Recycle Bin is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || orgFilter
                ? 'No deleted items matching your search and filter criteria.'
                : 'There are currently no deleted folders or files in the system. All repository documents are active.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Item &amp; Type</th>
                  <th className="py-3 px-4">Original Location / File Path</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Deleted By &amp; Time</th>
                  <th className="py-3 px-4 text-right">Actions (Super Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {combinedItems.map((item) => {
                  const isFolder = item.item_type === 'FOLDER';
                  const title = isFolder ? item.name : item.title;
                  const originalPath = isFolder 
                    ? (item.original_parent_path || 'Root Directory') 
                    : (item.target_folder_path || 'Uncategorized');

                  return (
                    <tr key={`${item.item_type}-${item.id}`} className="hover:bg-slate-50/80 transition group">
                      
                      {/* Item & Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          {isFolder ? (
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 shrink-0">
                              <Folder className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="shrink-0">{getFileIcon(item.document_type)}</div>
                          )}

                          <div className="min-w-0 max-w-xs sm:max-w-sm">
                            <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{title}</span>
                              {isFolder ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold shrink-0">
                                  FOLDER
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold shrink-0">
                                  {item.document_type || 'FILE'} ({item.current_version_number || 'V1'})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {isFolder 
                                ? `${item.document_count || 0} files • ${item.subfolder_count || 0} subfolders`
                                : `${formatFileSize(item.file_size)} • ${item.category || 'General'} • ${item.original_filename || ''}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Original Location / File Path */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 font-mono text-[11px] max-w-md truncate">
                            <Folder className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate">{item.full_path || originalPath}</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Restores straight back to this path</span>
                          </div>
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          item.organization_id === 1 || item.organization_code === 'RAHEE'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          <Building2 className="w-3 h-3" />
                          <span>{item.organization_name || (item.organization_id === 1 ? 'Rahee Infratech' : 'Ircon International')}</span>
                        </span>
                      </td>

                      {/* Deleted By & Time */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center space-x-1">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            <span>{item.deleted_by_name || 'System / Admin'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>{formatDate(item.deleted_at)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => isFolder ? handleRestoreFolder(item) : handleRestoreDocument(item)}
                            disabled={actionLoading}
                            title="Restore item back to original folder location"
                            className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Restore</span>
                          </button>

                          <button
                            onClick={() => isFolder ? handlePermanentDeleteFolder(item) : handlePermanentDeleteDocument(item)}
                            disabled={actionLoading}
                            title="Permanently purge item from system"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
