import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import { 
  Search, 
  Filter, 
  Upload, 
  Eye, 
  Download, 
  History, 
  FileText, 
  Building2, 
  Plus, 
  ExternalLink, 
  Lock, 
  Folder, 
  FolderPlus, 
  FolderOpen,
  X, 
  Shield, 
  ShieldAlert, 
  Settings, 
  RotateCw, 
  Key, 
  CheckCircle2, 
  Compass, 
  Trash2, 
  RotateCcw, 
  Archive, 
  Edit2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Calendar
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFormattedFolderList } from '../utils/folderUtils';
import FolderTreeSelect from '../components/FolderTreeSelect';

export default function Documents() {
  const { user, hasPermission } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [totalDocumentsCount, setTotalDocumentsCount] = useState(0);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'ARCHIVED'
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(searchParams.get('folder_id') || '');
  const [expandedPathDepthMap, setExpandedPathDepthMap] = useState({});

  const handleExpandPath = (e, docId) => {
    e.stopPropagation();
    setExpandedPathDepthMap(prev => ({
      ...prev,
      [docId]: (prev[docId] || 1) + 1
    }));
  };

  const handleResetPathDepth = (e, docId) => {
    e.stopPropagation();
    setExpandedPathDepthMap(prev => ({
      ...prev,
      [docId]: 1
    }));
  };

  useEffect(() => {
    const fid = searchParams.get('folder_id');
    if (fid !== null && fid !== undefined && fid !== selectedFolderId) {
      setSelectedFolderId(fid);
    }
  }, [searchParams]);

  const currentSelectedFolderObj = useMemo(() => {
    return folders.find(f => f.id === parseInt(selectedFolderId));
  }, [folders, selectedFolderId]);

  // Client-side strict tab filtering to guarantee active vs archive separation
  const displayedDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (activeTab === 'ARCHIVED') {
        return doc.status === 'ARCHIVED';
      } else {
        return doc.status !== 'ARCHIVED';
      }
    });
  }, [documents, activeTab]);

  // Format File Size Helper
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format Date with Time Stamp Helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' • ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Build Full Directory Hierarchy Trail (Root -> Parent -> Child)
  const getDocumentFolderTrail = (doc) => {
    const targetFolderId = doc.folder_id || doc.original_folder_id;
    const trail = [];
    if (targetFolderId) {
      let currId = parseInt(targetFolderId);
      const visited = new Set();
      while (currId && !visited.has(currId)) {
        visited.add(currId);
        const folder = folders.find(f => f.id === currId);
        if (!folder) break;
        if (!folder.parent_id && ['BIKRAMSHILA', 'BKS'].includes((folder.name || '').trim().toUpperCase())) {
          break;
        }
        trail.unshift({ id: folder.id, name: folder.name });
        currId = folder.parent_id;
      }
    }
    return trail;
  };

  const getDocumentFullPath = (doc) => {
    const rootName = 'Bikramshila Drive';
    const trail = getDocumentFolderTrail(doc);
    if (trail.length > 0) {
      return `${rootName} / ${trail.map(f => f.name).join(' / ')}`;
    }
    return `${rootName} / Root Directory`;
  };

  // Windows Explorer Navigation History (Back / Forward / Up)
  const [navHistory, setNavHistory] = useState(['']);
  const [navIndex, setNavIndex] = useState(0);
  const [recentForwardMap, setRecentForwardMap] = useState({});

  const navigateToFolder = (targetFolderId) => {
    const strId = targetFolderId !== undefined && targetFolderId !== null ? String(targetFolderId) : '';
    if (strId === selectedFolderId) return;

    // Remember previous child when leaving a subfolder so forward arrow can jump back into it
    if (selectedFolderId) {
      setRecentForwardMap(prev => ({
        ...prev,
        [strId || 'root']: selectedFolderId
      }));
    }

    setSelectedFolderId(strId);
    setNavHistory(prev => {
      const nextHistory = prev.slice(0, navIndex + 1);
      nextHistory.push(strId);
      return nextHistory;
    });
    setNavIndex(prev => prev + 1);
  };

  const handleNavBack = () => {
    if (navIndex > 0) {
      const prevId = navHistory[navIndex - 1];
      if (selectedFolderId) {
        setRecentForwardMap(prev => ({
          ...prev,
          [prevId || 'root']: selectedFolderId
        }));
      }
      setNavIndex(navIndex - 1);
      setSelectedFolderId(prevId);
    } else if (currentSelectedFolderObj) {
      const parent = folders.find(f => f.id === currentSelectedFolderObj.parent_id);
      if (parent && !(!parent.parent_id && ['BIKRAMSHILA', 'BKS'].includes((parent.name || '').trim().toUpperCase()))) {
        navigateToFolder(currentSelectedFolderObj.parent_id);
      } else {
        navigateToFolder('');
      }
    }
  };

  const canGoForward = navIndex < navHistory.length - 1 || Boolean(recentForwardMap[selectedFolderId || 'root']);
  const canGoBack = navIndex > 0 || Boolean(currentSelectedFolderObj?.parent_id) || Boolean(selectedFolderId);

  const handleNavForward = () => {
    if (navIndex < navHistory.length - 1) {
      const nextId = navHistory[navIndex + 1];
      setNavIndex(navIndex + 1);
      setSelectedFolderId(nextId);
    } else if (recentForwardMap[selectedFolderId || 'root']) {
      const forwardTargetId = recentForwardMap[selectedFolderId || 'root'];
      navigateToFolder(forwardTargetId);
    }
  };

  const handleNavUp = () => {
    if (currentSelectedFolderObj) {
      const parent = folders.find(f => f.id === currentSelectedFolderObj.parent_id);
      if (parent && !(!parent.parent_id && ['BIKRAMSHILA', 'BKS'].includes((parent.name || '').trim().toUpperCase()))) {
        navigateToFolder(currentSelectedFolderObj.parent_id);
      } else {
        navigateToFolder('');
      }
    }
  };

  // Compute full hierarchical breadcrumb path from Bikramshila Drive down to current selected folder
  const breadcrumbTrail = useMemo(() => {
    if (!selectedFolderId) return [];
    const trail = [];
    let currId = parseInt(selectedFolderId);
    const visited = new Set();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const folder = folders.find(f => f.id === currId);
      if (!folder) break;
      // Root Bikramshila folder is represented by the "Bikramshila Drive" root button itself
      if (!folder.parent_id && ['BIKRAMSHILA', 'BKS'].includes((folder.name || '').trim().toUpperCase())) {
        break;
      }
      trail.unshift(folder);
      currId = folder.parent_id;
    }

    return trail;
  }, [selectedFolderId, folders]);

  // Folder Creation Modal state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [parentFolderId, setParentFolderId] = useState('');
  const [isOperational, setIsOperational] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState('');

  // Folder Rename Modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Folder Access Control & Settings Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderOperationalState, setFolderOperationalState] = useState(false);
  const [permissionsList, setPermissionsList] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState('FULL_CONTROL');
  const [applyToSubfolders, setApplyToSubfolders] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [accessModalMessage, setAccessModalMessage] = useState('');

  // Archival Policy Manual Trigger state
  const [runningArchival, setRunningArchival] = useState(false);

  // Modals state
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState(null);
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState(null);
  const [historyVersions, setHistoryVersions] = useState([]);

  // STRICT RULE: Folder & Document Management is PERMITTED for Rahul Dey, Rahee Admin, Ircon Admin & Super Admin.
  const userEmail = user?.email?.toLowerCase() || '';
  const userName = user?.name?.toLowerCase() || '';
  const userRole = user?.role_name || '';

  // Explicit checks for Rahul Dey, Rajib Ghosh, Om Jha, and Somnath Mondal
  const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || user?.id === 5;
  const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || user?.is_super_admin || user?.role_id === 1 || user?.id === 11;
  const isOmJha = userEmail.startsWith('om.jha@') || userName.includes('om jha') || user?.id === 10;
  const isSomnathMondal = userEmail === 's.mondal@rahee.com' || userName.includes('somnath mondal') || user?.id === 9;
  const isAuthorizedUploader = isRahulDey || isOmJha || isSomnathMondal;

  const isRaheeAdmin = !isSomnathMondal && (isRahulDey || isRajibGhosh || ((user?.organization_id === 1 || user?.organization_code === 'RAHEE' || userEmail.includes('@rahee.com')) && (
    [2, 3].includes(user?.role_id) ||
    ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
    user?.designation === 'Admin' ||
    userEmail.startsWith('rahul.d@')
  )));

  const isIrconAdmin = isOmJha || ((user?.organization_id === 2 || user?.organization_code === 'IRCON' || userEmail.includes('@ircon.org')) && (
    [8].includes(user?.role_id) ||
    ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
    user?.designation === 'Admin' ||
    userEmail.startsWith('om.jha@')
  ));

  const isCompanyAdmin = user?.is_super_admin || isRahulDey || isRajibGhosh || isOmJha || isRaheeAdmin || isIrconAdmin;
  const canCreateFolder = !isSomnathMondal && (user?.is_super_admin || isRahulDey || isRajibGhosh || isOmJha || isRaheeAdmin || isIrconAdmin);

  const canDeleteDocument = (doc) => {
    if (user?.is_super_admin) return true;
    if (isRahulDey || isRajibGhosh || isOmJha) return true;
    if (isRaheeAdmin) {
      if (!doc?.organization_id || parseInt(doc.organization_id) === 1) return true;
    }
    if (isIrconAdmin) {
      if (!doc?.organization_id || parseInt(doc.organization_id) === 2) return true;
    }
    return false;
  };

  const canArchiveDocument = (doc) => {
    // STRICT RULE: Only Super Admin (Rajib Ghosh) can archive documents
    return isRajibGhosh || user?.is_super_admin || user?.role_id === 1;
  };

  const canRestoreDocument = (doc) => {
    // STRICT RULE: Only Super Admin (Rajib Ghosh) can restore documents from Archive
    return isRajibGhosh || user?.is_super_admin || user?.role_id === 1;
  };

  const canDeleteFolder = (folder) => {
    if (!folder || isSomnathMondal) return false;
    if (user?.is_super_admin) return true;
    if (isRahulDey || isRajibGhosh || isOmJha) return true;
    if (isRaheeAdmin) {
      if (!folder?.organization_id || parseInt(folder.organization_id) === 1) return true;
    }
    if (isIrconAdmin) {
      if (!folder?.organization_id || parseInt(folder.organization_id) === 2) return true;
    }
    return false;
  };

  const canRenameFolder = (folder) => {
    if (!folder || isSomnathMondal) return false;
    if (user?.is_super_admin) return true;
    if (isRahulDey || isRajibGhosh || isOmJha) return true;
    if (isRaheeAdmin) {
      if (!folder?.organization_id || parseInt(folder.organization_id) === 1) return true;
    }
    if (isIrconAdmin) {
      if (!folder?.organization_id || parseInt(folder.organization_id) === 2) return true;
    }
    return false;
  };

  const fetchFolders = async () => {
    try {
      const res = await api.get('/folders');
      if (res.data.success) {
        setFolders(res.data.folders);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const fetchDocuments = async (isLoadMore = false, customOffset = null) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const currentOffset = customOffset !== null 
        ? customOffset 
        : (isLoadMore ? documents.length : 0);

      let queryParams = [
        `limit=30`,
        `offset=${currentOffset}`
      ];

      // Tab Filtering: Active Documents vs Archived Documents
      if (activeTab === 'ARCHIVED') {
        queryParams.push('status=ARCHIVED');
      } else {
        queryParams.push('status_not=ARCHIVED');
      }

      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (typeFilter) queryParams.push(`document_type=${encodeURIComponent(typeFilter)}`);
      if (companyFilter) queryParams.push(`organization_id=${encodeURIComponent(companyFilter)}`);
      if (selectedFolderId) queryParams.push(`folder_id=${encodeURIComponent(selectedFolderId)}`);
      if (fromDate) queryParams.push(`from_date=${encodeURIComponent(fromDate)}`);
      if (toDate) queryParams.push(`to_date=${encodeURIComponent(toDate)}`);

      const queryString = `?${queryParams.join('&')}`;
      const res = await api.get(`/documents${queryString}`);
      if (res.data.success) {
        const fetchedDocs = res.data.documents || [];
        const total = res.data.total !== undefined ? res.data.total : fetchedDocs.length;

        if (isLoadMore) {
          setDocuments(prev => [...prev, ...fetchedDocs]);
        } else {
          setDocuments(fetchedDocs);
        }

        setTotalDocumentsCount(total);
        const newLoadedCount = isLoadMore ? (documents.length + fetchedDocs.length) : fetchedDocs.length;
        setHasMoreDocuments(newLoadedCount < total);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMoreDocuments) {
      fetchDocuments(true, documents.length);
    }
  };

  useEffect(() => {
    fetchFolders();
    // Fetch system users for Access Control dropdown
    api.get('/users').then(res => {
      if (res.data.success) {
        setSystemUsers(res.data.users || []);
      }
    }).catch(err => console.warn(err));

    // Live Real-Time Polling: automatically sync folders every 5 seconds when tab is active
    const liveInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchFolders();
      }
    }, 5000);

    return () => clearInterval(liveInterval);
  }, []);

  useEffect(() => {
    fetchDocuments(false, 0);
  }, [activeTab, search, typeFilter, companyFilter, selectedFolderId, fromDate, toDate]);

  const isIrconUser = user?.organization_id === 2 || user?.role_name === 'IRCON_ADMIN' || user?.role_name === 'IRCON_ADMIN_REVIEWER' || user?.email?.toLowerCase().startsWith('om.jha@') || user?.email?.toLowerCase().includes('ircon');
  const isRaheeUser = user?.organization_id === 1 || user?.role_name === 'RAHEE_ADMIN' || user?.role_name === 'RAHEE_ADMIN_REVIEWER' || user?.role_name === 'RAHEE_EXEC_ADMIN' || user?.email?.toLowerCase().startsWith('rahul.d@') || user?.email?.toLowerCase().startsWith('s.mondal@') || user?.email?.toLowerCase().includes('rahee');

  const myBranch = isIrconUser ? 'IRCON' : (isRaheeUser ? 'RAHEE' : '');
  // Company isolation: Ircon users see only IRCON branch, Rahee users see only RAHEE branch, Super Admin sees all
  const formattedFolders = user?.is_super_admin 
    ? getFormattedFolderList(folders) 
    : (myBranch ? getFormattedFolderList(folders, myBranch) : getFormattedFolderList(folders));
  const creatableParentFolders = formattedFolders;

  const handleOpenCreateFolderModal = () => {
    setFolderName('');
    setFolderDesc('');
    setFolderError('');

    // Default to currently selected active folder/subfolder if one is selected
    if (selectedFolderId && folders.some(f => f.id === parseInt(selectedFolderId))) {
      setParentFolderId(String(selectedFolderId));
      const curFolder = folders.find(f => f.id === parseInt(selectedFolderId));
      setIsOperational(curFolder?.is_operational === 1 || curFolder?.is_operational === true);
    } else if (creatableParentFolders.length > 0) {
      setParentFolderId(String(creatableParentFolders[0].id));
      setIsOperational(creatableParentFolders[0].is_operational === 1 || creatableParentFolders[0].is_operational === true);
    } else {
      setParentFolderId('');
      setIsOperational(false);
    }

    setShowFolderModal(true);
  };

  useEffect(() => {
    if (showFolderModal) {
      if (selectedFolderId && folders.some(f => f.id === parseInt(selectedFolderId))) {
        if (!parentFolderId) {
          setParentFolderId(String(selectedFolderId));
        }
      } else if (!parentFolderId && creatableParentFolders.length > 0) {
        setParentFolderId(String(creatableParentFolders[0].id));
      }
    }
  }, [showFolderModal, creatableParentFolders, selectedFolderId]);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    setFolderError('');
    if (!folderName.trim()) {
      setFolderError('Folder name is required.');
      return;
    }

    const effectiveParentId = parentFolderId || (creatableParentFolders.length > 0 ? creatableParentFolders[0].id : null);

    if (!effectiveParentId) {
      setFolderError('A parent folder selection is required for folder creation.');
      return;
    }

    try {
      setCreatingFolder(true);
      const res = await api.post('/folders', {
        name: folderName.trim(),
        description: folderDesc.trim(),
        parent_id: effectiveParentId ? parseInt(effectiveParentId) : null,
        is_operational: isOperational ? 1 : 0
      });

      setCreatingFolder(false);
      if (res.data.success) {
        setFolderName('');
        setFolderDesc('');
        setParentFolderId('');
        setIsOperational(false);
        setShowFolderModal(false);
        fetchFolders();
        if (res.data.folder) {
          setSelectedFolderId(res.data.folder.id);
        }
      }
    } catch (err) {
      setCreatingFolder(false);
      setFolderError(err.response?.data?.message || 'Failed to create folder.');
    }
  };

  const handleOpenRenameFolder = (folder) => {
    if (!folder) return;
    setFolderToRename(folder);
    setNewFolderName(folder.name || '');
    setNewFolderDesc(folder.description || '');
    setRenameError('');
    setShowRenameModal(true);
  };

  const handleRenameFolderSubmit = async (e) => {
    e.preventDefault();
    if (!folderToRename) return;
    setRenameError('');

    if (!newFolderName.trim()) {
      setRenameError('Folder name cannot be empty.');
      return;
    }

    try {
      setRenamingFolder(true);
      const res = await api.put(`/folders/${folderToRename.id}`, {
        name: newFolderName.trim(),
        description: newFolderDesc.trim(),
        parent_id: folderToRename.parent_id,
        is_operational: folderToRename.is_operational ? 1 : 0
      });
      setRenamingFolder(false);
      if (res.data.success) {
        setShowRenameModal(false);
        fetchFolders();
        fetchDocuments();
      }
    } catch (err) {
      setRenamingFolder(false);
      setRenameError(err.response?.data?.message || 'Failed to rename folder.');
    }
  };

  const handleOpenFolderAccessControl = async (folder) => {
    setEditingFolder(folder);
    setFolderOperationalState(folder.is_operational === 1 || folder.is_operational === true);
    setAccessModalMessage('');
    setApplyToSubfolders(false);
    setSelectedTargetKey('');

    try {
      const res = await api.get(`/folders/${folder.id}/permissions`);
      if (res.data.success) {
        setPermissionsList(res.data.permissions || []);
      }
    } catch (err) {
      console.error('Failed to load folder permissions:', err);
      setPermissionsList([]);
    }

    setShowAccessModal(true);
  };

  const handleAddPermissionRule = () => {
    if (!selectedTargetKey) return;
    const parts = selectedTargetKey.split(':');
    const type = parts[0];
    const targetId = parseInt(parts[1]);

    if (type === 'role') {
      if (permissionsList.some(p => p.role_id === targetId)) {
        setAccessModalMessage('Permission rule for this role already exists in table.');
        return;
      }
      const roleNameMap = {
        1: 'SUPER_ADMIN',
        2: 'RAHEE_ADMIN',
        6: 'MANAGER_OVERSIGHT',
        7: 'DOCUMENT_UPLOADER',
        8: 'IRCON_ADMIN'
      };

      const newRule = {
        folder_id: editingFolder.id,
        role_id: targetId,
        user_id: null,
        role_name: roleNameMap[targetId] || `Role #${targetId}`,
        user_name: null,
        permission_level: selectedPermissionLevel
      };
      setPermissionsList([...permissionsList, newRule]);
    } else if (type === 'user') {
      if (permissionsList.some(p => p.user_id === targetId)) {
        setAccessModalMessage('Permission rule for this user account already exists in table.');
        return;
      }
      const u = systemUsers.find(userObj => userObj.id === targetId);
      const newRule = {
        folder_id: editingFolder.id,
        role_id: null,
        user_id: targetId,
        role_name: null,
        user_name: u ? `${u.name} (${u.email})` : `User #${targetId}`,
        permission_level: selectedPermissionLevel
      };
      setPermissionsList([...permissionsList, newRule]);
    }

    setSelectedTargetKey('');
    setAccessModalMessage('');
  };

  const handleRemovePermissionRule = (index) => {
    const updated = [...permissionsList];
    updated.splice(index, 1);
    setPermissionsList(updated);
  };

  const handleSaveFolderSettingsAndPermissions = async (e) => {
    e.preventDefault();
    if (!editingFolder) return;
    setSavingPermissions(true);
    setAccessModalMessage('');

    try {
      // 1. Update operational folder non-archival setting
      await api.put(`/folders/${editingFolder.id}`, {
        name: editingFolder.name,
        description: editingFolder.description,
        parent_id: editingFolder.parent_id,
        is_operational: folderOperationalState ? 1 : 0
      });

      // 2. Update folder access control permissions
      await api.post(`/folders/${editingFolder.id}/permissions`, {
        permissions: permissionsList,
        apply_to_subfolders: applyToSubfolders
      });

      setSavingPermissions(false);
      setShowAccessModal(false);
      fetchFolders();
      alert(`Folder '${editingFolder.name}' settings and access control permissions updated successfully.`);
    } catch (err) {
      setSavingPermissions(false);
      setAccessModalMessage(err.response?.data?.message || 'Failed to update folder settings.');
    }
  };

  const handleRunArchivalPolicy = async () => {
    const scopeMessage = selectedFolderId ? 'all active documents in the currently selected folder' : 'all active documents across the repository';
    if (!window.confirm(`Execute Bikramshila Manual Document Archival Policy now? This will move ${scopeMessage} to Archive.`)) {
      return;
    }

    try {
      setRunningArchival(true);
      const res = await api.post('/documents/run-archival-policy', {
        folder_id: selectedFolderId || null
      });
      setRunningArchival(false);
      if (res.data.success) {
        alert(`Bikramshila Manual Document Archival Policy Executed Successfully!\n\nDocuments Archived: ${res.data.archivedCount}\n${res.data.archivedDocTitles?.length > 0 ? `Archived Files:\n- ${res.data.archivedDocTitles.join('\n- ')}` : 'No active documents were found to archive.'}`);
        fetchDocuments();
      }
    } catch (err) {
      setRunningArchival(false);
      alert('Failed to execute archival policy: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDownload = async (doc, versionId) => {
    try {
      const baseVersionQuery = versionId ? `?version_id=${versionId}` : '';
      const res = await api.get(`/documents/${doc.id}/download${baseVersionQuery}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      
      let fileName = doc.original_filename || doc.title || 'document';
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
      alert('Failed to download document file. Please try again.');
    }
  };

  const handleOpenVersionHistory = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}`);
      if (res.data.success) {
        setSelectedHistoryDoc(doc);
        setHistoryVersions(res.data.versions);
      }
    } catch (err) {
      alert('Failed to load version history: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (!canDeleteDocument(doc)) {
      alert('Forbidden: Document deletion is restricted to Company Admins (Rahul Dey, Om Jha) and Super Admin (Rajib Ghosh).');
      return;
    }
    if (!window.confirm(`Are you sure you want to move document "${doc.title}" to the Recycle Bin? Super Admin (Rajib Ghosh) can restore it to this exact directory at any time.`)) {
      return;
    }
    try {
      const res = await api.delete(`/documents/${doc.id}`);
      if (res.data.success) {
        alert(res.data.message || `Document "${doc.title}" moved to Recycle Bin.`);
        fetchDocuments();
        fetchFolders();
      }
    } catch (err) {
      alert('Failed to delete document: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!canDeleteFolder(folder)) {
      alert('Forbidden: Folder deletion is restricted to Rahul Dey, Rajib Ghosh, Om Jha, and Company Admins.');
      return;
    }
    if (!window.confirm(`Are you sure you want to move folder "${folder.name}" and its contents to the Recycle Bin? Super Admin (Rajib Ghosh) can restore it at any time.`)) {
      return;
    }
    try {
      const res = await api.delete(`/folders/${folder.id}`);
      if (res.data.success) {
        alert(res.data.message || `Folder "${folder.name}" moved to Recycle Bin.`);
        setShowAccessModal(false);
        fetchFolders();
        fetchDocuments();
      }
    } catch (err) {
      alert('Failed to delete folder: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleArchiveDocument = async (doc) => {
    if (!window.confirm(`Are you sure you want to move document "${doc.title}" to Archive?`)) {
      return;
    }
    try {
      const res = await api.post(`/documents/${doc.id}/archive`);
      if (res.data.success) {
        alert(res.data.message);
        // Immediately remove from current active list view
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        setTotalDocumentsCount(prev => Math.max(0, prev - 1));
        fetchDocuments(false, 0);
        fetchFolders();
      }
    } catch (err) {
      alert('Failed to archive document: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRestoreDocument = async (doc) => {
    if (!window.confirm(`Restore archived document "${doc.title}" back into active Bikramshila folder hierarchy?`)) {
      return;
    }
    try {
      const res = await api.post(`/documents/${doc.id}/restore`);
      if (res.data.success) {
        alert(res.data.message);
        // Immediately remove from current archived list view
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        setTotalDocumentsCount(prev => Math.max(0, prev - 1));
        fetchDocuments(false, 0);
        fetchFolders();
      }
    } catch (err) {
      alert('Failed to restore document: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-2.5">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-black text-slate-900 tracking-tight shrink-0">Document Repository</h1>
          
          {/* Active Repository vs Archive Docs Tab Selector */}
          <div className="flex items-center space-x-1 p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'ACTIVE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Documents</span>
            </button>

            <button
              onClick={() => setActiveTab('ARCHIVED')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'ARCHIVED'
                  ? 'bg-white text-amber-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-amber-600" />
              <span>Archive Docs</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {canCreateFolder && (
            <button
              onClick={handleOpenCreateFolderModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Folder</span>
            </button>
          )}

          {isAuthorizedUploader && (
            <Link
              to={selectedFolderId ? `/documents/upload?folder_id=${selectedFolderId}` : "/documents/upload"}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition shrink-0"
              title={selectedFolderId ? `Upload documents into current directory` : "Upload Documents"}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Documents</span>
            </Link>
          )}
        </div>
      </div>

      {/* Folder Navigation & Address Bar (Windows Explorer Style - Thin & Sleek) */}
      <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2 text-xs">
        
        {/* Navigation History Arrows (Back, Forward, Up to Parent) */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={handleNavBack}
            disabled={!canGoBack}
            title="Back to previous folder (Alt + Left Arrow)"
            className="p-1 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNavForward}
            disabled={!canGoForward}
            title="Forward to recently exited folder (Alt + Right Arrow)"
            className="p-1 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition border border-slate-200"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNavUp}
            disabled={!selectedFolderId || (currentSelectedFolderObj && !currentSelectedFolderObj.parent_id && ['BIKRAMSHILA', 'BKS'].includes((currentSelectedFolderObj.name || '').trim().toUpperCase()))}
            title={(() => {
              if (!selectedFolderId) return 'Bikramshila Drive';
              const parent = folders.find(f => f.id === currentSelectedFolderObj?.parent_id);
              if (parent && !(!parent.parent_id && ['BIKRAMSHILA', 'BKS'].includes((parent.name || '').trim().toUpperCase()))) {
                return `Up to parent "${parent.name}"`;
              }
              return 'Up to Bikramshila Drive';
            })()}
            className="p-1 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition border border-slate-200"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Explorer Address Bar with Clickable Breadcrumbs */}
        <div className="flex-1 flex items-center justify-between h-7 px-2.5 bg-slate-50 hover:bg-white border border-slate-300 hover:border-blue-400 focus-within:border-blue-500 rounded-lg transition overflow-x-auto overflow-y-hidden">
          
          <div className="flex items-center space-x-1 min-w-0 flex-1">
            {/* Root Drive / Bikramshila Drive Icon */}
            <button
              type="button"
              onClick={() => navigateToFolder('')}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] transition shrink-0 font-bold ${
                !selectedFolderId || (breadcrumbTrail.length === 0 && selectedFolderId)
                  ? 'bg-blue-100 text-blue-900'
                  : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
              title="Jump to Bikramshila Drive (All Folders)"
            >
              <HardDrive className="w-3 h-3 text-blue-600" />
              <span>Bikramshila Drive</span>
            </button>

            {/* Interactive Breadcrumb Path Segments */}
            {breadcrumbTrail.map((folderItem, idx) => {
              const isLast = idx === breadcrumbTrail.length - 1;
              return (
                <React.Fragment key={folderItem.id}>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0 select-none" />
                  <button
                    type="button"
                    onClick={() => navigateToFolder(folderItem.id)}
                    className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] transition shrink-0 ${
                      isLast
                        ? 'bg-white font-black text-slate-900 border border-slate-200 shadow-2xs'
                        : 'font-semibold text-slate-700 hover:bg-slate-200/80 hover:text-blue-700'
                    }`}
                    title={`Jump to parent/folder "${folderItem.name}"`}
                  >
                    <Folder className={`w-3 h-3 ${isLast ? 'text-amber-500 fill-amber-400' : 'text-amber-600'}`} />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{folderItem.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Refresh Button at the right end of address bar */}
          <div className="shrink-0 pl-1.5 flex items-center">
            <button
              type="button"
              onClick={() => {
                fetchFolders();
                fetchDocuments();
              }}
              title="Refresh Folder & Documents (F5)"
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded transition"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* Smart Filters Bar (Non-Scrollable Single Line with Minimal Height) */}
      <div className="bg-white px-2.5 h-9 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 text-xs w-full">
        
        {/* Search input */}
        <div className="relative flex-1 min-w-[110px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full h-7 pl-8 pr-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none bg-slate-50/50 hover:bg-white transition"
          />
        </div>

        {/* Folder Filter (Tree Select) */}
        <div className="w-36 sm:w-44 shrink-0 min-w-0">
          <FolderTreeSelect
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelect={(id) => navigateToFolder(id)}
            branchName={user?.is_super_admin ? null : myBranch}
            allowAll={true}
            allLabel="All Folders"
            compact={true}
            className="w-full"
          />
        </div>

        {/* Company Filter */}
        <div className="w-24 sm:w-28 shrink-0">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="w-full h-7 px-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-slate-700 font-medium"
          >
            <option value="">All Companies</option>
            <option value="1">Rahee</option>
            <option value="2">Ircon</option>
          </select>
        </div>

        {/* Document Type Filter */}
        <div className="w-20 sm:w-24 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full h-7 px-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-slate-700 font-medium"
          >
            <option value="">All Types</option>
            <option value="PDF">PDF</option>
            <option value="WORD">Word</option>
            <option value="EXCEL">Excel</option>
            <option value="POWERPOINT">PPT</option>
            <option value="IMAGE">Image</option>
            <option value="CAD">CAD</option>
          </select>
        </div>

        {/* Compact Date Range Filter with Icons */}
        <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-1.5 h-7 text-xs shrink-0">
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" title="From Date" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From Date"
            className="bg-transparent text-[11px] text-slate-700 font-medium focus:outline-none w-[84px] py-0 cursor-pointer"
          />
          <span className="text-slate-300 select-none text-[10px]">&rarr;</span>
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" title="To Date" />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To Date"
            className="bg-transparent text-[11px] text-slate-700 font-medium focus:outline-none w-[84px] py-0 cursor-pointer"
          />
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setFromDate(''); setToDate(''); }}
              title="Clear date range"
              className="text-slate-400 hover:text-slate-700 font-bold ml-0.5 text-xs"
            >
              ✕
            </button>
          )}
        </div>

      </div>

      {/* Selected Folder Banner */}
      {currentSelectedFolderObj && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-bold">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900">{currentSelectedFolderObj.name}</h2>
                {currentSelectedFolderObj.is_operational ? (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200">
                    Operational Folder
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {currentSelectedFolderObj.description || 'Dedicated document directory'} &bull; <strong>{documents.length}</strong> active documents
              </p>
            </div>
          </div>

          {(canRenameFolder(currentSelectedFolderObj) || canDeleteFolder(currentSelectedFolderObj) || isCompanyAdmin || isAuthorizedUploader) && (
            <div className="flex items-center space-x-2 self-end sm:self-center">
              {isAuthorizedUploader && (
                <Link
                  to={`/documents/upload?folder_id=${currentSelectedFolderObj.id}`}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  title={`Upload files directly into "${currentSelectedFolderObj.name}"`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Here</span>
                </Link>
              )}
              {canCreateFolder && (
                <button
                  onClick={handleOpenCreateFolderModal}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition border border-emerald-300 shadow-sm"
                  title={`Create a subfolder inside "${currentSelectedFolderObj.name}"`}
                >
                  <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ New Subfolder</span>
                </button>
              )}
              {canRenameFolder(currentSelectedFolderObj) && (
                <button
                  onClick={() => handleOpenRenameFolder(currentSelectedFolderObj)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition border border-amber-300 shadow-sm"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Rename Folder</span>
                </button>
              )}
              {canDeleteFolder(currentSelectedFolderObj) && (
                <button
                  onClick={() => handleDeleteFolder(currentSelectedFolderObj)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition border border-rose-200 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Folder</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Loading document repository...
          </div>
        ) : displayedDocuments.length > 0 ? (
          <div className="overflow-x-auto overflow-y-visible min-h-[320px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Document Title &amp; Details</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Doc Info</th>
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Uploaded By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Document Title & Description */}
                    <td className="py-3.5 px-4">
                      <div>
                        <Link to={`/documents/${doc.id}`} className="font-bold text-slate-900 hover:text-blue-600 text-sm line-clamp-1">
                          {doc.title}
                        </Link>
                        {doc.description && (
                          <p className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">{doc.description}</p>
                        )}
                      </div>
                    </td>

                    {/* Document Type Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        doc.document_type === 'CAD' ? 'bg-teal-100 text-teal-800' :
                        doc.document_type === 'PDF' ? 'bg-rose-100 text-rose-800' :
                        doc.document_type === 'WORD' ? 'bg-blue-100 text-blue-800' :
                        doc.document_type === 'EXCEL' ? 'bg-emerald-100 text-emerald-800' :
                        doc.document_type === 'POWERPOINT' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {doc.document_type}
                      </span>
                    </td>

                    {/* Doc Info / Folder Column with Clean Standard Hover Card */}
                    <td className="py-3.5 px-4 relative group/info">
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.folder_id) {
                            navigateToFolder(doc.folder_id);
                          } else {
                            navigateToFolder('');
                          }
                        }}
                        className="flex items-center space-x-1.5 text-slate-700 cursor-pointer w-fit hover:text-blue-600 transition text-left"
                        title={doc.folder_name ? `Folder: ${doc.folder_name} (Click to open & sync top navigation)` : 'Uncategorized (Click for Root)'}
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-xs truncate max-w-[140px]">{doc.folder_name || 'Uncategorized'}</span>
                      </button>

                      {/* Clean Standard Horizontal Expandable Path Popup (Ultra-Compact Height) */}
                      <div className="absolute left-4 top-full mt-1.5 w-96 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700/80 z-[9999] pointer-events-none group-hover/info:pointer-events-auto opacity-0 scale-95 translate-y-1 group-hover/info:opacity-100 group-hover/info:scale-100 group-hover/info:translate-y-0 transition-all duration-150 ease-out before:absolute before:-top-3 before:left-0 before:w-full before:h-3 before:content-['']">
                        {(() => {
                          const trail = getDocumentFolderTrail(doc);
                          const totalLevels = trail.length + 1; // including Bikramshila Drive Root
                          const currentDepth = expandedPathDepthMap[doc.id] || 1;
                          const hasHiddenAncestors = currentDepth < totalLevels;
                          const showRoot = currentDepth >= totalLevels;
                          const visibleFolders = trail.length > 0 ? trail.slice(Math.max(0, trail.length - currentDepth)) : [];

                          return (
                            <div className="space-y-2">
                              {/* Compact Header with Title, Expand Button & Size */}
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div className="flex items-center space-x-1.5 font-bold text-xs text-blue-400">
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>Document Path</span>
                                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                                    (Step {Math.min(currentDepth, totalLevels)}/{totalLevels})
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  {hasHiddenAncestors ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleExpandPath(e, doc.id)}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-100 rounded border border-blue-500/40 text-[10px] font-bold cursor-pointer transition shadow-xs"
                                      title="Click to expand 1 parent folder backwards towards Root"
                                    >
                                      <span>Expand Parent</span>
                                      <span className="text-xs font-black leading-none">+</span>
                                    </button>
                                  ) : totalLevels > 1 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleResetPathDepth(e, doc.id)}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 text-[10px] font-medium cursor-pointer transition"
                                      title="Collapse path"
                                    >
                                      <span>Collapse</span>
                                    </button>
                                  ) : null}

                                  <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded-md border border-blue-500/20">
                                    {formatFileSize(doc.file_size)}
                                  </span>
                                </div>
                              </div>

                              {/* Horizontal Expandable Path Bar (Exact sync with Top Navigation Bar) */}
                              <div className="bg-slate-950/90 border border-slate-800 p-2 rounded-lg font-mono text-[11px] text-slate-300 flex items-center flex-wrap gap-1">
                                {hasHiddenAncestors && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleExpandPath(e, doc.id)}
                                    className="px-1.5 py-0.5 bg-blue-900/50 hover:bg-blue-800/80 text-blue-300 hover:text-blue-100 rounded border border-blue-500/40 font-bold flex items-center space-x-0.5 cursor-pointer transition text-[10px]"
                                    title="Click to expand 1 level backwards towards Root"
                                  >
                                    <span>...</span>
                                    <span className="font-black text-xs">+</span>
                                  </button>
                                )}

                                {showRoot && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToFolder('');
                                    }}
                                    className="text-blue-400 hover:text-blue-300 hover:underline font-bold flex items-center space-x-1 cursor-pointer bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-700 transition text-[11px]"
                                    title="Jump to Bikramshila Drive Root"
                                  >
                                    <HardDrive className="w-3 h-3 text-blue-400 shrink-0 inline" />
                                    <span>Bikramshila Drive</span>
                                  </button>
                                )}

                                {visibleFolders.map((f, idx) => {
                                  const isImmediateFolder = idx === visibleFolders.length - 1;
                                  return (
                                    <React.Fragment key={f.id}>
                                      {(showRoot || idx > 0 || hasHiddenAncestors) && (
                                        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigateToFolder(f.id);
                                        }}
                                        className={`hover:underline font-semibold flex items-center space-x-1 cursor-pointer bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-700 transition text-[11px] ${
                                          isImmediateFolder ? 'text-amber-300 font-bold' : 'text-emerald-300'
                                        }`}
                                        title={`Jump directly to folder "${f.name}"`}
                                      >
                                        <Folder className="w-3 h-3 shrink-0" />
                                        <span className="truncate max-w-[130px]">{f.name}</span>
                                      </button>
                                    </React.Fragment>
                                  );
                                })}

                                {visibleFolders.length === 0 && !hasHiddenAncestors && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToFolder('');
                                    }}
                                    className="text-blue-400 hover:text-blue-300 hover:underline font-bold flex items-center space-x-1 cursor-pointer bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-700 transition text-[11px]"
                                    title="Open Root Directory"
                                  >
                                    <HardDrive className="w-3 h-3 text-blue-400 shrink-0 inline" />
                                    <span>Bikramshila Drive</span>
                                  </button>
                                )}

                                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                                <span className="text-slate-300 font-bold truncate flex items-center space-x-1 max-w-[140px]" title={doc.original_filename || doc.title}>
                                  <FileText className="w-3 h-3 text-blue-400 shrink-0 inline" />
                                  <span className="truncate">{doc.original_filename || doc.title}</span>
                                </span>
                              </div>

                              {/* Clean Compact Details Footer */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                                <span>Category: <strong className="text-slate-200">{doc.category || 'General'}</strong></span>
                                <span>Type: <strong className="text-slate-200">{doc.document_type || 'N/A'}</strong></span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Company Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          doc.organization_id === 1 || doc.organization_code === 'RAHEE'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {doc.organization_name || (doc.organization_id === 1 ? 'Rahee Infratech' : 'Ircon International')}
                        </span>
                      </div>
                    </td>

                    {/* Uploaded By with Date and Time Stamp */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-bold">{doc.uploader_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatDateTime(doc.created_at)}</div>
                    </td>

                    {/* Action Column (History Icon Removed) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        
                        <button
                          onClick={() => setSelectedPreviewDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Preview Document Stream"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Download Document File"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <Link
                          to={`/documents/${doc.id}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="Open Details & Review Trail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>

                        {doc.status !== 'ARCHIVED' && canArchiveDocument(doc) && (
                          <button
                            onClick={() => handleArchiveDocument(doc)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition"
                            title="Move Document to Archive"
                          >
                            <Archive className="w-4 h-4 text-amber-600" />
                          </button>
                        )}

                        {doc.status === 'ARCHIVED' && canRestoreDocument(doc) && (
                          <button
                            onClick={() => handleRestoreDocument(doc)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                            title="Restore Document (Back from Archive)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {canDeleteDocument(doc) && (
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700 text-sm">
              {activeTab === 'ARCHIVED' ? 'No Archived Documents' : 'No Documents Found'}
            </p>
            <p className="mt-1">
              {activeTab === 'ARCHIVED'
                ? 'No documents have been archived yet.'
                : 'No documents match your active tenant scope or search filters.'}
            </p>
          </div>
        )}


        {/* Dynamic Pagination & 30-File Chunk Load More Controls */}
        {!loading && displayedDocuments.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 font-medium flex items-center space-x-2">
              <span>
                Showing <strong className="text-slate-900 font-black">{displayedDocuments.length}</strong> of <strong className="text-slate-900 font-black">{totalDocumentsCount}</strong> documents
              </span>
              {hasMoreDocuments && (
                <span className="text-[11px] text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                  +{Math.min(30, totalDocumentsCount - displayedDocuments.length)} more
                </span>
              )}
            </div>

            <div>
              {hasMoreDocuments ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading next 30 files...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More (+30)</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All {totalDocumentsCount} documents loaded</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <DocumentPreviewModal
        isOpen={!!selectedPreviewDoc}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
        onDownload={handleDownload}
      />

      <VersionHistoryModal
        isOpen={!!selectedHistoryDoc}
        onClose={() => setSelectedHistoryDoc(null)}
        versions={historyVersions}
        documentTitle={selectedHistoryDoc?.title}
        onDownloadVersion={(ver) => handleDownload(selectedHistoryDoc, ver.id)}
      />

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-base">
                <FolderPlus className="w-5 h-5 text-emerald-600" />
                <span>Create New Tenant Folder</span>
              </div>
              <button onClick={() => setShowFolderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {folderError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200">
                {folderError}
              </div>
            )}

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Parent Folder
                </label>
                <FolderTreeSelect
                  folders={folders}
                  selectedFolderId={parentFolderId}
                  onSelect={(selId, node) => {
                    setParentFolderId(selId);
                    if (node && (node.is_operational === 1 || node.is_operational === true)) {
                      setIsOperational(true);
                    }
                  }}
                  branchName={user?.is_super_admin ? null : myBranch}
                  placeholder="Select Parent Folder..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Folder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., Financial Audits 2026 or Operational Docs"
                  required
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Folder Description
                </label>
                <input
                  type="text"
                  value={folderDesc}
                  onChange={(e) => setFolderDesc(e.target.value)}
                  placeholder="Optional description or context..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>



              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  {creatingFolder ? 'Creating Folder...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Folder Access Control & Operational Settings Modal */}
      {showAccessModal && editingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-base">
                <Settings className="w-5 h-5 text-blue-600" />
                <span>Folder Access Control & Settings — {editingFolder.name}</span>
              </div>
              <button onClick={() => setShowAccessModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {accessModalMessage && (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-xl border border-amber-200">
                {accessModalMessage}
              </div>
            )}

            <form onSubmit={handleSaveFolderSettingsAndPermissions} className="space-y-5">
              


              {/* Section 2: Admin Access Control Permission Settings for Folders & Subfolders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <span>Role & User Access Control Permissions</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Admin Configurable</span>
                </div>

                {/* Add Rule Input Row */}
                <div className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <select
                    value={selectedTargetKey}
                    onChange={(e) => setSelectedTargetKey(e.target.value)}
                    className="flex-1 p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="">Select Role or User Account to Assign Access...</option>
                    <optgroup label="System Roles">
                      <option value="role:1">SUPER_ADMIN (Super Admin - Rajib Ghosh)</option>
                      <option value="role:2">RAHEE_ADMIN (Rahee Admin - Rahul Dey)</option>
                      <option value="role:7">DOCUMENT_UPLOADER (Execution Control - Somnath Mondal)</option>
                      <option value="role:8">IRCON_ADMIN (Ircon Admin - Om Jha)</option>
                      <option value="role:6">MANAGER_OVERSIGHT (Managers & Viewers)</option>
                    </optgroup>
                    {systemUsers && systemUsers.length > 0 && (
                      <optgroup label="Individual User Accounts">
                        {systemUsers.map((u) => (
                          <option key={u.id} value={`user:${u.id}`}>
                            👤 {u.name} ({u.email}) — [{u.role_name || u.role}]
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <select
                    value={selectedPermissionLevel}
                    onChange={(e) => setSelectedPermissionLevel(e.target.value)}
                    className="p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-semibold"
                  >
                    <option value="FULL_CONTROL">Full Control (View, Upload, Manage)</option>
                    <option value="WRITE">Write / Upload Access</option>
                    <option value="READ">Read / View Only</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddPermissionRule}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shrink-0"
                  >
                    Add Rule
                  </button>
                </div>

                {/* Active Permission Rules List */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Target Role / User Account</th>
                        <th className="py-2.5 px-3">Access Control Level</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {permissionsList.length > 0 ? (
                        permissionsList.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {p.user_id ? (
                                <span className="flex items-center space-x-1.5 text-indigo-700">
                                  <span>👤</span>
                                  <span>{p.user_name ? `${p.user_name}` : `User ID #${p.user_id}`}</span>
                                </span>
                              ) : (
                                <span className="flex items-center space-x-1.5 text-slate-800">
                                  <span>🛡️</span>
                                  <span>{p.role_name || `Role ID #${p.role_id}`}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                {p.permission_level}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemovePermissionRule(idx)}
                                className="text-rose-600 hover:text-rose-800 text-xs font-semibold"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="py-4 text-center text-slate-400 italic">
                            No custom role or user access rules added. Default organization RBAC permissions apply.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Checkbox: Apply to all subfolders */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToSubfolders}
                    onChange={(e) => setApplyToSubfolders(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-indigo-950">
                    Apply these access control permissions recursively to all child subfolders
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  {canDeleteFolder(editingFolder) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(editingFolder)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-200 flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Folder</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAccessModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPermissions}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition"
                  >
                    {savingPermissions ? 'Saving Settings...' : 'Save Settings & Permissions'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameModal && folderToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">Rename Folder</h3>
                  <p className="text-[11px] text-slate-400">Update Directory Name & Description</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!renamingFolder) setShowRenameModal(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Folder Info */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-3 text-xs">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 border border-amber-200">
                <Folder className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">Current: {folderToRename.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {folderToRename.parent_folder_name ? `Parent: ${folderToRename.parent_folder_name}` : 'Root / Top-level Branch'}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleRenameFolderSubmit} className="p-6 space-y-4 text-xs">
              {renameError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{renameError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  New Folder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. Design Specifications 2026"
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Folder Description (Optional)
                </label>
                <textarea
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  rows={2}
                  placeholder="Brief description of documents stored in this directory..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={renamingFolder}
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renamingFolder || !newFolderName.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {renamingFolder ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Renaming...</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Save & Rename</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

