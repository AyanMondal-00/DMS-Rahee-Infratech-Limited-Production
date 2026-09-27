import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { 
  ArrowLeft, 
  Eye, 
  Download, 
  Trash2, 
  Archive, 
  RotateCcw,
  XCircle,
  FolderOpen,
  Folder,
  ChevronRight,
  FileText,
  HardDrive
} from 'lucide-react';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useNotification();
  const [document, setDocument] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Archival & Restoration state
  const [archivingDoc, setArchivingDoc] = useState(false);
  const [restoringDoc, setRestoringDoc] = useState(false);
  const [breadcrumbDepth, setBreadcrumbDepth] = useState(1);

  // Modals state
  const [showPreview, setShowPreview] = useState(false);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      const [docRes, foldRes] = await Promise.all([
        api.get(`/documents/${id}`),
        api.get('/folders').catch(() => ({ data: { success: false, folders: [] } }))
      ]);
      if (docRes.data.success) {
        setDocument(docRes.data.document);
      }
      if (foldRes.data.success) {
        setFolders(foldRes.data.folders || []);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const computedFolderTrail = useMemo(() => {
    let rawTrail = [];
    if (document?.folder_trail && document.folder_trail.length > 0) {
      rawTrail = [...document.folder_trail];
    } else {
      const targetFolderId = document?.folder_id || document?.original_folder_id;
      if (targetFolderId && folders.length > 0) {
        let currId = parseInt(targetFolderId);
        const visited = new Set();
        while (currId && !visited.has(currId)) {
          visited.add(currId);
          const f = folders.find(folder => folder.id === currId);
          if (!f) break;
          rawTrail.unshift(f);
          currId = f.parent_id;
        }
      }
    }
    // Filter out top-level Bikramshila root node because the root drive is "Bikramshila Drive"
    return rawTrail.filter(f => !( !f.parent_id && ['BIKRAMSHILA', 'BKS'].includes((f.name || '').trim().toUpperCase()) ));
  }, [document, folders]);

  useEffect(() => {
    fetchDocumentData();
  }, [id]);

  const handleDownload = async (docObj) => {
    try {
      const targetDoc = docObj || document;
      const res = await api.get(`/documents/${targetDoc.id}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      
      let fileName = targetDoc.original_filename || targetDoc.title || 'document';
      const contentDisposition = res.headers['content-disposition'];
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) fileName = match[1];
      }
      
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      showAlert({
        title: 'Download Failed',
        message: 'Failed to download document file. Please try again.',
        type: 'error'
      });
    }
  };

  const handleRestoreDocument = async () => {
    const confirmed = await showConfirm({
      title: 'Restore Document',
      message: `Restore archived document "${document?.title}" back to Active Documents?`,
      confirmText: 'Restore Document',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      setRestoringDoc(true);
      const res = await api.post(`/documents/${id}/restore`);
      setRestoringDoc(false);
      if (res.data.success) {
        showAlert({
          title: 'Document Restored',
          message: res.data.message || `Document "${document?.title}" has been restored.`,
          type: 'success'
        });
        fetchDocumentData();
      }
    } catch (err) {
      setRestoringDoc(false);
      showAlert({
        title: 'Restoration Failed',
        message: 'Failed to restore document: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const handleArchiveDocument = async () => {
    const confirmed = await showConfirm({
      title: 'Archive Document',
      message: `Are you sure you want to move document "${document?.title}" to Archive?`,
      confirmText: 'Archive Document',
      isDanger: false
    });
    if (!confirmed) return;

    try {
      setArchivingDoc(true);
      const res = await api.post(`/documents/${id}/archive`);
      setArchivingDoc(false);
      if (res.data.success) {
        showAlert({
          title: 'Document Archived',
          message: res.data.message || `Document "${document?.title}" moved to archive.`,
          type: 'success'
        });
        fetchDocumentData();
      }
    } catch (err) {
      setArchivingDoc(false);
      showAlert({
        title: 'Archival Failed',
        message: 'Failed to archive document: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const userEmail = user?.email?.toLowerCase() || '';
  const userName = user?.name?.toLowerCase() || '';
  const userRole = user?.role_name || '';

  // Explicit checks for Rahul Dey, Rajib Ghosh, and Om Jha
  const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || user?.id === 5;
  const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || user?.is_super_admin || user?.role_id === 1 || user?.id === 11;
  const isOmJha = userEmail.startsWith('om.jha@') || userName.includes('om jha') || user?.id === 10;

  const isRaheeAdmin = isRahulDey || isRajibGhosh || ((user?.organization_id === 1 || user?.organization_code === 'RAHEE' || userEmail.includes('@rahee.com')) && (
    [2, 3].includes(user?.role_id) ||
    ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
    user?.designation === 'Admin' ||
    userEmail.startsWith('rahul.d@') ||
    userEmail.startsWith('s.mondal@') ||
    user?.permissions?.includes('delete') ||
    user?.permissions?.includes('delete_document')
  ));

  const isIrconAdmin = isOmJha || ((user?.organization_id === 2 || user?.organization_code === 'IRCON' || userEmail.includes('@ircon.org')) && (
    [8].includes(user?.role_id) ||
    ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
    user?.designation === 'Admin' ||
    userEmail.startsWith('om.jha@') ||
    user?.permissions?.includes('delete') ||
    user?.permissions?.includes('delete_document')
  ));

  const isCompanyAdmin = user?.is_super_admin || isRahulDey || isRajibGhosh || isOmJha || isRaheeAdmin || isIrconAdmin;

  const canDeleteDocument = user?.is_super_admin || isRahulDey || isRajibGhosh || isOmJha || (
    isRaheeAdmin && (!document?.organization_id || parseInt(document.organization_id) === 1)
  ) || (
    isIrconAdmin && (!document?.organization_id || parseInt(document.organization_id) === 2)
  );

  const canArchiveDocument = isRajibGhosh || user?.is_super_admin || user?.role_id === 1;
  const canRestoreDocument = isRajibGhosh || user?.is_super_admin || user?.role_id === 1;

  const handleDeleteDocument = async () => {
    if (!canDeleteDocument) {
      showAlert({
        title: 'Access Restricted',
        message: 'Forbidden: Document deletion is restricted to Company Admins and Super Admin.',
        type: 'error'
      });
      return;
    }
    const confirmed = await showConfirm({
      title: 'Delete Document',
      message: `Are you sure you want to move document "${document?.title}" to Recycle Bin?`,
      confirmText: 'Move to Recycle Bin',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      const res = await api.delete(`/documents/${id}`);
      if (res.data.success) {
        await showAlert({
          title: 'Document Deleted',
          message: res.data.message || `Document "${document?.title}" deleted successfully.`,
          type: 'success'
        });
        navigate('/documents');
      }
    } catch (err) {
      showAlert({
        title: 'Delete Failed',
        message: 'Failed to delete document: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Document Access Error</h2>
        <p className="text-xs text-slate-500 mt-1">The requested document was not found or access is restricted under tenant isolation.</p>
        <Link to="/documents" className="mt-4 inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
          Return to Repository
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explorer-Style Horizontal Directory Path Bar (Identical to Folder Navigation) */}
      <div className="flex items-center justify-between h-8 px-3 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl transition shadow-2xs overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-0 flex-1">
          {/* Root Drive / Bikramshila Drive Icon */}
          <Link
            to="/documents"
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-200/80 hover:text-blue-700 transition shrink-0"
            title="Jump to Bikramshila Drive (All Folders)"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>Bikramshila Drive</span>
          </Link>

          {computedFolderTrail && computedFolderTrail.length > 0 ? (
            computedFolderTrail.map((folderItem, idx) => {
              const isLast = idx === computedFolderTrail.length - 1;
              return (
                <React.Fragment key={folderItem.id}>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 select-none" />
                  <Link
                    to={`/documents?folder_id=${folderItem.id}`}
                    className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] transition shrink-0 ${
                      isLast
                        ? 'bg-amber-50 font-bold text-slate-900 border border-amber-300/80 shadow-2xs'
                        : 'font-semibold text-slate-700 hover:bg-slate-200/80 hover:text-blue-700'
                    }`}
                    title={isLast ? `Uploaded Folder: "${folderItem.name}" (Click to open)` : `Parent Folder: "${folderItem.name}" (Click to open)`}
                  >
                    <Folder className={`w-3 h-3 ${isLast ? 'text-amber-500 fill-amber-400' : 'text-amber-600'}`} />
                    <span className="truncate max-w-[150px]">{folderItem.name}</span>
                    {isLast && (
                      <span className="text-[9px] font-normal text-amber-800 bg-amber-100/90 px-1 rounded ml-1 border border-amber-200">
                        (Uploaded Folder)
                      </span>
                    )}
                  </Link>
                </React.Fragment>
              );
            })
          ) : (
            <>
              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 select-none" />
              <span className="text-slate-500 text-[11px] px-1">Root Directory</span>
            </>
          )}

          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 select-none" />
          <span className="flex items-center space-x-1 font-bold text-[11px] text-blue-700 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded shrink-0 max-w-[220px]" title={document.original_filename || document.title}>
            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{document.original_filename || document.title}</span>
          </span>
        </div>

        <div className="shrink-0 pl-3 text-[11px] text-slate-500 font-mono flex items-center space-x-2">
          {document.file_size && (
            <span className="text-slate-600 font-semibold">
              {(document.file_size / (1024 * 1024)).toFixed(2)} MB
            </span>
          )}
          <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
            {document.document_type}
          </span>
        </div>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link to="/documents" className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {document.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Type: <strong className="text-slate-700">{document.document_type}</strong> &bull; Company: <strong className="text-slate-700">{document.organization_name || (document.organization_id === 1 ? 'Rahee Infratech Limited' : 'Ircon International Limited')}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition border border-blue-200 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Preview Document</span>
          </button>

          <button
            onClick={() => handleDownload(document)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          {canArchiveDocument && document.status !== 'ARCHIVED' && (
            <button
              onClick={handleArchiveDocument}
              disabled={archivingDoc}
              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition border border-amber-300 cursor-pointer"
              title="Archive Document (Move to Archive List)"
            >
              <Archive className="w-4 h-4 text-amber-600" />
            </button>
          )}

          {canRestoreDocument && document.status === 'ARCHIVED' && (
            <button
              onClick={handleRestoreDocument}
              disabled={restoringDoc}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs transition border border-emerald-300 cursor-pointer"
              title="Restore Document (Back from Archive)"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
            </button>
          )}

          {canDeleteDocument && (
            <button
              onClick={handleDeleteDocument}
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-200 cursor-pointer"
              title="Delete Document"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
            </button>
          )}
        </div>
      </div>

      {/* Main Document Details Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">Document Information</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {document.document_type}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {document.description || 'No description provided.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-100">
          <div>
            <span className="text-slate-400 block font-semibold text-[11px]">Folder / Location:</span>
            <div className="flex items-center space-x-1 font-bold text-slate-800 flex-wrap mt-0.5">
              {computedFolderTrail && computedFolderTrail.length > 0 ? (
                computedFolderTrail.map((f, idx) => (
                  <React.Fragment key={f.id}>
                    {idx > 0 && <span className="text-slate-400 font-normal">/</span>}
                    <Link
                      to={`/documents?folder_id=${f.id}`}
                      className={`hover:underline flex items-center space-x-0.5 ${idx === computedFolderTrail.length - 1 ? 'text-blue-700 font-bold' : 'text-slate-700'}`}
                      title={`Open folder "${f.name}"`}
                    >
                      <span>📁</span>
                      <span>{f.name}</span>
                    </Link>
                  </React.Fragment>
                ))
              ) : (
                <span className="text-slate-700">Root Directory</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold text-[11px]">Company / Organization:</span>
            <span className="font-bold text-slate-800">
              {document.organization_name || (document.organization_id === 1 ? 'Rahee Infratech Limited' : 'Ircon International Limited')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold text-[11px]">Uploaded By:</span>
            <span className="font-bold text-slate-800">{document.uploader_name}</span>
            <span className="text-slate-500 block text-[10px]">{document.uploader_email}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold text-[11px]">Upload Timestamp:</span>
            <span className="font-bold text-slate-800">{new Date(document.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <DocumentPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        document={document}
        onDownload={handleDownload}
      />

    </div>
  );
}
