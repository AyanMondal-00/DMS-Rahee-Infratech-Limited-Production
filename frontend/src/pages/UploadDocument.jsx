import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useNavigate, Navigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  ShieldAlert, 
  ArrowLeft, 
  Trash2, 
  Plus, 
  FileCheck2,
  Sparkles,
  Layers,
  Loader2,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getFormattedFolderList } from '../utils/folderUtils';
import FolderTreeSelect from '../components/FolderTreeSelect';

// Dedicated Smooth High-Speed Uploading Animation Overlay
function UploadingAnimationModal({ loading, progress, stage, stats, totalFiles, documentType }) {
  if (!loading) return null;

  const isDone = stage === 'done';
  const loadedMB = (stats.loaded / 1024 / 1024).toFixed(2);
  const totalMB = (stats.total / 1024 / 1024).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6 text-white relative overflow-hidden">
        
        {/* Ambient Glowing Background */}
        <div className={`absolute -top-24 -left-24 w-48 h-48 ${isDone ? 'bg-emerald-500/20' : 'bg-blue-500/20'} rounded-full blur-3xl pointer-events-none transition-colors duration-300`}></div>
        <div className={`absolute -bottom-24 -right-24 w-48 h-48 ${isDone ? 'bg-teal-500/20' : 'bg-indigo-500/20'} rounded-full blur-3xl pointer-events-none transition-colors duration-300`}></div>

        {/* Dynamic Graphic Art Animation */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          {/* Outer Pulsing Radar Ring */}
          <div className={`absolute inset-0 rounded-full ${isDone ? 'bg-emerald-500/10 border-2 border-emerald-500/30' : 'bg-blue-500/10 border-2 border-blue-500/30'} animate-ping opacity-60`}></div>
          
          {/* Rotating Gradient Spinner Ring */}
          {!isDone ? (
            <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-blue-500 border-r-indigo-400 animate-spin"></div>
          ) : (
            <div className="absolute inset-1 rounded-full border-2 border-emerald-400/60 shadow-lg shadow-emerald-500/20"></div>
          )}
          
          {/* Inner Glowing Disk */}
          <div className={`w-20 h-20 rounded-full ${isDone ? 'bg-gradient-to-tr from-emerald-950 to-slate-800 border-emerald-500/40' : 'bg-gradient-to-tr from-indigo-900/90 to-slate-800 border-slate-700'} border flex flex-col items-center justify-center shadow-inner relative z-10 transition-all duration-200`}>
            {isDone ? (
              <div className="animate-in zoom-in-50 duration-200">
                <CheckCircle className="w-10 h-10 text-emerald-400 drop-shadow-lg" />
              </div>
            ) : (
              <FileText className="w-8 h-8 text-blue-400 drop-shadow-md animate-pulse" />
            )}
          </div>
        </div>

        {/* Title & Status Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-black tracking-tight text-slate-100">
            {isDone
              ? '🎉 Upload Complete!'
              : stage === 'processing' 
                ? '⚡ Finalizing & Ingesting Documents...' 
                : `🚀 Uploading ${totalFiles} Document(s)...`}
          </h3>
          <p className={`text-xs ${isDone ? 'text-emerald-400 font-bold' : 'text-blue-400 font-semibold'} transition-all duration-200`}>
            {isDone 
              ? 'Redirecting to Central Repository...' 
              : stage === 'processing' 
                ? 'Ingesting metadata & real-time verification' 
                : `${loadedMB} MB of ${totalMB} MB transferred`}
          </p>
        </div>

        {/* Progress Bar & MegaBytes Stats */}
        <div className="space-y-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-bold">
              {loadedMB} MB / {totalMB} MB
            </span>
            <span className="text-emerald-400 font-extrabold text-sm">
              {progress}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-150 ease-out shadow-lg"
              style={{ width: `${Math.max(progress, 5)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Real-Time SHA-256 Verified</span>
            </span>
            <span>Format: <strong className="text-slate-200">{documentType || 'Auto'}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
}

const EXT_TYPE_MAP = {
  PDF: 'PDF',
  DOC: 'WORD',
  DOCX: 'WORD',
  XLS: 'EXCEL',
  XLSX: 'EXCEL',
  PPT: 'POWERPOINT',
  PPTX: 'POWERPOINT',
  JPG: 'IMAGE',
  JPEG: 'IMAGE',
  PNG: 'IMAGE',
  WEBP: 'IMAGE',
  SVG: 'IMAGE',
  DWG: 'CAD',
  DXF: 'CAD',
  STL: 'CAD',
  OBJ: 'CAD',
  STEP: 'CAD',
  STP: 'CAD',
  IGES: 'CAD'
};

const TYPE_LABELS = {
  PDF: '📄 PDF Document (.pdf)',
  CAD: '📐 CAD Drawing / 3D Model (.dwg, .dxf, .stl, .obj, .step, .stp, .iges)',
  POWERPOINT: '📊 Microsoft PowerPoint (.ppt, .pptx)',
  IMAGE: '🖼️ Image (.jpg, .jpeg, .png, .webp, .svg)',
  WORD: '📝 Microsoft Word (.doc, .docx)',
  EXCEL: '📊 Microsoft Excel (.xls, .xlsx)'
};

const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.js', '.msi', '.vbs', '.dll', '.com', '.scr', '.pif', '.jar'];

export default function UploadDocument() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFolderParam = searchParams.get('folder_id') || '';
  const fileInputRef = useRef(null);

  const userEmail = user?.email?.toLowerCase() || '';
  const userName = user?.name?.toLowerCase() || '';
  const isAuthorizedUploader = 
    userEmail === 'rahul.d@rahee.com' ||
    userEmail.startsWith('om.jha@') ||
    userEmail === 's.mondal@rahee.com' ||
    userName.includes('rahul dey') ||
    userName.includes('om jha') ||
    userName.includes('somnath mondal') ||
    [5, 9, 10].includes(user?.id);

  if (!isAuthorizedUploader) {
    return <Navigate to="/documents" replace />;
  }

  const [documentType, setDocumentType] = useState('');
  const [filesList, setFilesList] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState(initialFolderParam || '');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadStats, setUploadStats] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFolders = async () => {
      try {
        const res = await api.get('/folders');
        if (!isMounted) return;

        if (res.data?.success) {
          const folderList = res.data.folders || [];
          setFolders(folderList);

          // 1. If folder_id is passed as query param, preselect that folder
          if (initialFolderParam && folderList.some(f => String(f.id) === String(initialFolderParam))) {
            setFolderId(String(initialFolderParam));
            return;
          }

          // 2. Otherwise default to user's company branch folder
          const isIrcon = user?.organization_id === 2 || user?.role_name === 'IRCON_ADMIN_REVIEWER' || user?.role_name === 'IRCON_ADMIN' || user?.email?.toLowerCase().startsWith('om.jha@');
          const defaultBranch = isIrcon ? 'IRCON' : 'RAHEE';
          const defaultFolder = folderList.find(f => f.name && f.name.toUpperCase() === defaultBranch);
          if (defaultFolder) {
            setFolderId(defaultFolder.id.toString());
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Folder loading error guard:', err.message);
      }
    };

    loadFolders();

    return () => {
      isMounted = false;
    };
  }, [user, initialFolderParam]);

  const getAcceptString = (type) => {
    switch (type) {
      case 'PDF':
        return '.pdf,application/pdf';
      case 'CAD':
        return '.dwg,.dxf,.stl,.obj,.step,.stp,.iges';
      case 'POWERPOINT':
        return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'IMAGE':
        return '.jpg,.jpeg,.png,.webp,.svg,image/*';
      case 'WORD':
        return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'EXCEL':
        return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return '';
    }
  };

  const handleFormatChange = (newFormat) => {
    setDocumentType(newFormat);
    setError('');
    setSuccessMsg('');
    // If there were already files attached that do not match the new format, filter or warn
    if (filesList.length > 0 && newFormat) {
      const mismatched = filesList.filter(f => f.detectedType !== newFormat);
      if (mismatched.length > 0) {
        setFilesList(prev => prev.filter(f => f.detectedType === newFormat));
        setError(`Removed ${mismatched.length} file(s) that did not match format '${newFormat}'.`);
      }
    }
  };

  const handleDropzoneClick = () => {
    if (!documentType) {
      setError('Please choose a Document File Format from the dropdown first. Windows File Explorer will then open filtered for your chosen format.');
      return;
    }
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processIncomingFiles = (incomingFiles) => {
    setError('');
    setSuccessMsg('');

    if (!documentType) {
      setError('Please choose a Document File Format from the dropdown first before selecting files.');
      return;
    }

    if (!incomingFiles || incomingFiles.length === 0) return;

    const newEntries = [];
    const rejectedFiles = [];

    Array.from(incomingFiles).forEach(file => {
      const rawName = file.name;
      const lastDotIndex = rawName.lastIndexOf('.');
      const ext = lastDotIndex !== -1 ? rawName.slice(lastDotIndex).toLowerCase() : '';

      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        rejectedFiles.push(`${rawName} (Executable prohibited)`);
        return;
      }

      const rawExt = ext.replace('.', '').toUpperCase();
      const detectedType = EXT_TYPE_MAP[rawExt];

      if (!detectedType) {
        rejectedFiles.push(`${rawName} (Unsupported format)`);
        return;
      }

      if (detectedType !== documentType) {
        rejectedFiles.push(`${rawName} (Expected ${documentType}, got ${detectedType})`);
        return;
      }

      // Check if file is already in queue
      const isDuplicateInBatch = filesList.some(f => f.name === file.name && f.size === file.size);
      if (isDuplicateInBatch) {
        return; // Skip duplicate
      }

      const cleanTitle = lastDotIndex !== -1 ? rawName.slice(0, lastDotIndex).replace(/[_-]/g, ' ') : rawName;

      newEntries.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file: file,
        name: file.name,
        size: file.size,
        title: cleanTitle,
        detectedType: detectedType,
        documentType: detectedType
      });
    });

    if (rejectedFiles.length > 0) {
      setError(`Some files were skipped: ${rejectedFiles.join(', ')}`);
    }

    if (newEntries.length > 0) {
      setFilesList(prev => [...prev, ...newEntries]);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!documentType) {
      setError('Please choose a Document File Format from the dropdown first before dropping files.');
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
    e.target.value = ''; // Reset input so same files can be re-selected if needed
  };

  const handleTitleChange = (id, newTitle) => {
    setFilesList(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
  };

  const handleRemoveFile = (id) => {
    setFilesList(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setFilesList([]);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!documentType) {
      setError('Please select a Document File Format.');
      return;
    }

    if (filesList.length === 0) {
      setError('Please select at least one document file to upload.');
      return;
    }

    // Check titles
    const emptyTitle = filesList.find(f => !f.title || f.title.trim().length === 0);
    if (emptyTitle) {
      setError(`Document title cannot be empty for file: "${emptyTitle.name}".`);
      return;
    }

    if (!folderId) {
      setError('Please select a target destination folder.');
      return;
    }

    const totalBytes = filesList.reduce((acc, f) => acc + f.size, 0);

    const formData = new FormData();
    formData.append('folder_id', folderId);
    formData.append('document_type', documentType);
    formData.append('category', 'General');

    const metadata = filesList.map((item, index) => {
      formData.append('files', item.file);
      return {
        index: index,
        filename: item.file.name,
        title: item.title.trim(),
        document_type: documentType,
        folder_id: folderId
      };
    });

    formData.append('files_metadata', JSON.stringify(metadata));

    if (filesList.length === 1) {
      formData.append('title', filesList[0].title.trim());
      formData.append('document_type', documentType);
    }

    try {
      setLoading(true);
      setUploadProgress(0);
      setUploadStage('uploading');
      setUploadStats({ loaded: 0, total: totalBytes });

      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.min(Math.round((progressEvent.loaded * 100) / progressEvent.total), 99);
            setUploadProgress(percent);
            setUploadStats({
              loaded: progressEvent.loaded,
              total: progressEvent.total
            });
            if (percent >= 98) {
              setUploadStage('processing');
            }
          }
        }
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to upload document(s).');
      }

      setUploadProgress(100);
      setUploadStage('done');
      setUploadStats({ loaded: totalBytes, total: totalBytes });

      // Collect uploaded document IDs for the recent highlight badge
      const uploadedIds = [];
      if (Array.isArray(res.data.documents)) {
        res.data.documents.forEach(d => {
          if (d?.id && !uploadedIds.includes(d.id)) uploadedIds.push(d.id);
        });
      }
      if (res.data.documentId && !uploadedIds.includes(res.data.documentId)) {
        uploadedIds.push(res.data.documentId);
      }

      if (uploadedIds.length > 0) {
        try {
          localStorage.setItem('dms_recent_uploads', JSON.stringify({
            ids: uploadedIds,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('Failed to save recent uploads cache:', e);
        }
      }

      setSuccessMsg(res.data.message || `Successfully uploaded ${filesList.length} document(s)!`);
      
      // Snappy completion transition before instant redirect
      setTimeout(() => {
        setLoading(false);
        if (uploadedIds.length === 1 && filesList.length === 1) {
          navigate(`/documents/${uploadedIds[0]}`);
        } else {
          navigate('/documents');
        }
      }, 300);

    } catch (err) {
      setLoading(false);
      setUploadStage('');
      setError(err.response?.data?.message || err.message || 'Failed to upload document(s).');
    }
  };

  const isRaheeUploader = userEmail === 'rahul.d@rahee.com' || userEmail === 's.mondal@rahee.com' || [2, 3, 7].includes(user?.role_id) || ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN', 'DOCUMENT_UPLOADER'].includes(user?.role_name);
  const isIrconUploader = userEmail.startsWith('om.jha@') || user?.role_id === 8 || ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(user?.role_name);

  if (user?.is_super_admin || (!isRaheeUploader && !isIrconUploader)) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-rose-200 shadow-xl text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-lg font-black text-slate-900">Upload Permission Restricted</h2>
        <p className="text-xs text-slate-600">
          Document upload is restricted to authorized uploaders (Rahul Dey &amp; Somnath Mondal for Rahee under Bikramshila/RAHEE, Om Jha for Ircon under Bikramshila/IRCON).
        </p>
        <Link to="/documents" className="inline-block px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition">
          Return to Central Repository
        </Link>
      </div>
    );
  }

  const isIrconUser = user?.organization_id === 2 || user?.role_name === 'IRCON_ADMIN_REVIEWER' || user?.role_name === 'IRCON_ADMIN' || userEmail.startsWith('om.jha@');
  const myBranch = isIrconUser ? 'IRCON' : 'RAHEE';
  const allFormattedFolders = user?.is_super_admin ? getFormattedFolderList(folders) : getFormattedFolderList(folders, myBranch);

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      
      {/* Dynamic Smooth Uploading Animation Overlay */}
      <UploadingAnimationModal 
        loading={loading}
        progress={uploadProgress}
        stage={uploadStage}
        stats={uploadStats}
        totalFiles={filesList.length}
        documentType={documentType}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/documents" className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Upload Documents</h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-full">
                Multiple Files Supported
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select format and target folder first, then upload single or multiple documents.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Step 1: Format & Folder Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            
            {/* File Format Selector (Required First) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>1. Select Document File Format <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={documentType}
                onChange={(e) => handleFormatChange(e.target.value)}
                required
                className={`w-full p-3 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold transition ${
                  !documentType ? 'border-amber-400 ring-2 ring-amber-100 text-slate-500' : 'border-blue-500 text-slate-900 ring-1 ring-blue-200'
                }`}
              >
                <option value="">-- Choose Format (Required First) --</option>
                <option value="PDF">📄 PDF Documents (.pdf)</option>
                <option value="CAD">📐 CAD Drawings / 3D Models (.dwg, .dxf, .stl, .obj, .step, .stp, .iges)</option>
                <option value="WORD">📝 Microsoft Word (.doc, .docx)</option>
                <option value="EXCEL">📊 Microsoft Excel (.xls, .xlsx)</option>
                <option value="POWERPOINT">📊 Microsoft PowerPoint (.ppt, .pptx)</option>
                <option value="IMAGE">🖼️ Images (.jpg, .jpeg, .png, .webp, .svg)</option>
              </select>
              <p className="text-[11px] text-blue-600 font-semibold mt-1.5 flex items-center space-x-1">
      
              </p>
            </div>

            {/* Target Destination Folder (VS Code Tree View) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                2. Target Destination Folder <span className="text-rose-500">*</span>
              </label>
              <FolderTreeSelect
                folders={folders}
                selectedFolderId={folderId}
                onSelect={(id) => setFolderId(id)}
                branchName={user?.is_super_admin ? null : myBranch}
                placeholder="-- Select Destination Folder --"
                className="w-full"
                error={!folderId && error}
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Branch Scope: <strong className="text-slate-600">Bikramshila / {myBranch}</strong>
              </p>
            </div>

          </div>

          {/* Multi-File Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>3. Select or Drop Document File(s) <span className="text-rose-500">*</span></span>
              {documentType && (
                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 font-bold">
                  File Explorer Filter: <strong>{documentType}</strong>
                </span>
              )}
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); if (documentType) setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              onClick={handleDropzoneClick}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
                !documentType 
                  ? 'border-slate-300 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/30' 
                  : dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-blue-300 hover:border-blue-500 bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleInputChange}
                multiple
                className="hidden"
                accept={getAcceptString(documentType)}
              />

              <div className="space-y-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border shadow-sm transition ${
                  documentType ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  <Upload className="w-6 h-6" />
                </div>
                
                {documentType ? (
                  <>
                    <p className="font-bold text-slate-900 text-sm">
                      Click to browse or Drag &amp; Drop {documentType} document(s) here
                    </p>
                    <p className="text-xs text-slate-500">
                      Windows File Explorer will open filtered for: <strong className="text-blue-700">{TYPE_LABELS[documentType] || documentType}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400 italic">
                      You can select single or multiple files at once.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-amber-800 text-sm">
                      ⚠️ Please choose a Document File Format above first
                    </p>
                    <p className="text-xs text-slate-500">
                      Selecting the format enables the filtered Windows File Explorer for your files.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Selected Files Staging Table / Batch List */}
          {filesList.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Ready to Upload ({filesList.length})
                  </span>
                  <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                    {(filesList.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB Total
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleDropzoneClick}
                    className="flex items-center space-x-1 px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Files</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {filesList.map((item, idx) => (
                  <div 
                    key={item.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition hover:border-slate-300"
                  >
                    {/* Index & Type Badge */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="w-6 h-6 bg-slate-200 text-slate-700 rounded-lg text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="px-2 py-1 bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg shrink-0">
                        {item.detectedType}
                      </span>
                    </div>

                    {/* Editable Document Title */}
                    <div className="flex-1 w-full min-w-0">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Document Title (*)
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleTitleChange(item.id, e.target.value)}
                        required
                        placeholder="Document title..."
                        className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        Filename: <strong>{item.name}</strong> ({(item.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>

                    {/* Delete item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(item.id)}
                      title="Remove file from batch"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-Time Upload Progress Indicator */}
          {loading && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 truncate">
                      {uploadStage === 'processing' 
                        ? '⚡ Ingesting & Validating Documents...' 
                        : `🚀 Transferring ${filesList.length} Document(s) to Server...`}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {uploadStage === 'processing'
                        ? 'Computing SHA-256 signatures & storing database records in parallel'
                        : `${(uploadStats.loaded / 1024 / 1024).toFixed(2)} MB of ${(uploadStats.total / 1024 / 1024).toFixed(2)} MB transferred`}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono font-black text-blue-400 text-sm shrink-0">
                  {uploadProgress}%
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Link
              to="/documents"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading || filesList.length === 0}
              className={`flex items-center space-x-2 px-6 py-2.5 font-bold rounded-xl text-xs shadow-md transition ${
                loading || filesList.length === 0 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {loading 
                  ? uploadStage === 'processing' 
                    ? `Processing ${filesList.length} Document(s)...`
                    : `Uploading (${uploadProgress}%)...`
                  : filesList.length > 1 
                    ? `Upload All ${filesList.length} Documents` 
                    : 'Upload Document'}
              </span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
