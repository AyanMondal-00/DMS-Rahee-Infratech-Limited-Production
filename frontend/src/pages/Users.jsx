import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { 
  Users as UsersIcon, 
  Plus, 
  UserCheck, 
  UserX, 
  Shield, 
  Building2, 
  X, 
  AlertCircle, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  User,
  Mail,
  Lock,
  Briefcase,
  Layers,
  FileCheck,
  Upload,
  Check
} from 'lucide-react';

export default function Users() {
  const { user, hasPermission } = useAuth();
  const { showAlert, showConfirm } = useNotification();

  // Strict Rule: User governance is exclusively restricted to Super Admin
  if (!user?.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const [usersList, setUsersList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Reset Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // New User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [userFunction, setUserFunction] = useState('');
  const [documentCapability, setDocumentCapability] = useState('Viewer');
  const [orgId, setOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('ALL');

  const [rolePermissions, setRolePermissions] = useState([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data.success) {
        setUsersList(res.data.users);
      }

      const rolesRes = await api.get('/users/roles');
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.roles);
        if (rolesRes.data.rolePermissions) {
          setRolePermissions(rolesRes.data.rolePermissions);
        }
      }

      const orgRes = await api.get('/organizations');
      if (orgRes.data.success && orgRes.data.organizations.length > 0) {
        setOrgs(orgRes.data.organizations);
      } else {
        setOrgs([
          { id: 1, name: 'Rahee Infratech Limited', code: 'RAHEE' },
          { id: 2, name: 'Ircon International Limited', code: 'IRCON' }
        ]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!roleId) {
      setModalError('Please select a Function (Designation) to determine role permissions.');
      return;
    }

    if (user?.is_super_admin && !orgId) {
      setModalError('Please select a Company / Tenant Organization.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/users', {
        name: name.trim(),
        email: email.trim(),
        password,
        role_id: parseInt(roleId),
        designation: userFunction || 'Manager',
        document_capability: documentCapability || 'Viewer',
        organization_id: user?.is_super_admin ? parseInt(orgId) : user?.organization_id
      });
      setSubmitting(false);
      setShowCreateModal(false);
      setName('');
      setEmail('');
      setPassword('');
      setRoleId('');
      setUserFunction('');
      setDocumentCapability('Viewer');
      setOrgId('');
      showAlert({
        title: 'User Created Successfully',
        message: `Account for "${name.trim()}" (${email.trim()}) has been provisioned.`,
        type: 'success'
      });
      fetchUsers();
    } catch (err) {
      setSubmitting(false);
      setModalError(err.response?.data?.message || 'Failed to create user account.');
    }
  };

  const toggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const confirmed = await showConfirm({
      title: 'Update User Account Status',
      message: `Are you sure you want to change the status of ${targetUser.email} (${targetUser.name}) to ${newStatus}?`,
      confirmText: newStatus === 'ACTIVE' ? 'Enable Account' : 'Disable Account',
      isDanger: newStatus === 'DISABLED'
    });

    if (!confirmed) return;

    try {
      await api.patch(`/users/${targetUser.id}/status`, { status: newStatus });
      showAlert({
        title: 'Status Updated',
        message: `User ${targetUser.name} status is now ${newStatus}.`,
        type: 'success'
      });
      fetchUsers();
    } catch (err) {
      showAlert({
        title: 'Update Failed',
        message: 'Failed to update status: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const handleOpenResetModal = (targetUser) => {
    setSelectedUserForReset(targetUser);
    setNewResetPassword('');
    setConfirmResetPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetError('');
    setResetSuccess('');
    setShowResetModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!newResetPassword || newResetPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setResetSubmitting(true);
      const res = await api.put(`/users/${selectedUserForReset.id}/reset-password`, {
        password: newResetPassword
      });
      setResetSubmitting(false);
      setResetSuccess(res.data?.message || `Password for ${selectedUserForReset.name} has been reset successfully!`);
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess('');
      }, 1600);
    } catch (err) {
      setResetSubmitting(false);
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  const resetCreateForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setShowCreatePassword(false);
    setRoleId('');
    setUserFunction('');
    setDocumentCapability('Viewer');
    setOrgId('');
    setModalError('');
    setShowCreateModal(true);
  };

  // Helper to resolve role ID from function and document capability
  const updateRoleMapping = (func, cap, selectedOrgId) => {
    const org = selectedOrgId || orgId;
    if (func === 'Admin') {
      setRoleId((parseInt(org) === 2 || org === '2') ? '8' : '2');
    } else if (func === 'Execution Control' && cap === 'Upload') {
      setRoleId('7');
    } else {
      setRoleId('6');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organization Users & Access Control</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage enterprise accounts, roles, security capabilities, and tenant credentials.</p>
            </div>
          </div>
        </div>

        {(user?.is_super_admin || hasPermission('manage_users')) && (
          <button
            onClick={resetCreateForm}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {/* Company Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">Filter Users by Organization / Company:</span>
        </div>
        <select
          value={filterOrgId}
          onChange={(e) => setFilterOrgId(e.target.value)}
          className="p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
        >
          <option value="ALL">All Companies (Rahee Infratech & Ircon International)</option>
          <option value="1">Company 1: Rahee Infratech Limited (RAHEE)</option>
          <option value="2">Company 2: Ircon International Limited (IRCON)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Loading user registry...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-4 px-5">User Name & ID</th>
                  <th className="py-4 px-5">Organization</th>
                  <th className="py-4 px-5">Function / Designation</th>
                  <th className="py-4 px-5">Document Capability</th>
                  <th className="py-4 px-5">Password</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {usersList
                  .filter(u => filterOrgId === 'ALL' || (filterOrgId === '1' && (u.organization_id === 1 || u.organization_code === 'RAHEE')) || (filterOrgId === '2' && (u.organization_id === 2 || u.organization_code === 'IRCON')))
                  .map((u) => {
                    const isUploader = u.document_capability === 'Upload' || u.role_name === 'DOCUMENT_UPLOADER' || u.role_name === 'RAHEE_ADMIN' || u.role_name === 'IRCON_ADMIN';
                    const isSuper = u.designation === 'Super Admin' || u.role_name === 'SUPER_ADMIN';
                    const isAdmin = u.designation === 'Admin' || u.role_name === 'RAHEE_ADMIN' || u.role_name === 'IRCON_ADMIN';
                    const isExec = u.designation === 'Execution Control' || u.role_name === 'DOCUMENT_UPLOADER';
                    const isReviewer = u.designation === 'Review' || u.designation === 'Document Reviewer';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* User Name & ID */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-2xs ${
                              isSuper ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              isAdmin ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {u.name ? u.name.charAt(0) : 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs truncate">{u.name}</p>
                              <p className="text-[11px] text-blue-600 font-mono truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Organization */}
                        <td className="py-3.5 px-5 text-slate-700 font-medium">
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{u.organization_name || 'Global System'}</span>
                          </span>
                        </td>

                        {/* Function / Designation */}
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 font-bold rounded-lg text-xs border ${
                            isSuper
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-2xs'
                              : isAdmin
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs'
                              : isExec
                              ? 'bg-purple-50 text-purple-700 border-purple-200/80 shadow-2xs'
                              : isReviewer
                              ? 'bg-amber-50 text-amber-700 border-amber-200/80 shadow-2xs'
                              : 'bg-blue-50 text-blue-700 border-blue-200/80 shadow-2xs'
                          }`}>
                            <Briefcase className="w-3.5 h-3.5 opacity-75" />
                            <span>{u.designation || (u.role_name === 'DOCUMENT_UPLOADER' ? 'Execution Control' : u.role_name === 'SUPER_ADMIN' ? 'Super Admin' : isAdmin ? 'Admin' : 'Manager')}</span>
                          </span>
                        </td>

                        {/* Document Capability */}
                        <td className="py-3.5 px-5">
                          {isUploader && !isSuper ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-cyan-50 text-cyan-800 font-bold rounded-lg text-xs border border-cyan-200 shadow-2xs">
                              <Upload className="w-3.5 h-3.5 text-cyan-600" />
                              <span>Upload</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs border border-slate-200 shadow-2xs">
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Viewer</span>
                            </span>
                          )}
                        </td>

                        {/* Password Column */}
                        <td className="py-3.5 px-5">
                          {user?.is_super_admin && (
                            <button
                              type="button"
                              onClick={() => handleOpenResetModal(u)}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] shadow-2xs transition active:scale-95 cursor-pointer"
                              title={`Reset password for ${u.name}`}
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                              <span>Reset Password</span>
                            </button>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-5 text-right">
                          {(user?.is_super_admin || hasPermission('manage_users')) && u.role_name !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => toggleUserStatus(u)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition shadow-2xs active:scale-95 cursor-pointer ${
                                u.status === 'ACTIVE'
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modernized Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col border border-slate-200/80 overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-400/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight text-white">Create Enterprise User</h3>
                  <p className="text-xs text-slate-300">Set identity credentials, organization tenant & access rights</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-5 text-xs overflow-y-auto">
              
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-2xl flex items-center space-x-2.5 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Section 1: User Identity & Credentials */}
              <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. User Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Name (*)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="e.g. Rahul Sharma"
                        className="w-full p-2.5 pl-8 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email / Username (*)</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="rahul@raheeinfratech.com"
                        className="w-full p-2.5 pl-8 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Password (*)</label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter strong login password"
                      className="w-full p-2.5 pl-8 pr-9 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Organization Binding */}
              {(user?.is_super_admin || orgs.length > 0) && (
                <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>2. Tenant Organization Binding</span>
                  </div>
                  <select
                    value={orgId}
                    onChange={(e) => {
                      const newOrg = e.target.value;
                      setOrgId(newOrg);
                      if (userFunction) {
                        updateRoleMapping(userFunction, documentCapability, newOrg);
                      }
                    }}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">-- Select Company / Tenant Organization --</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.id === 1 || o.code === 'RAHEE' ? 'Company 1: Rahee Infratech Limited (RAHEE)' :
                         o.id === 2 || o.code === 'IRCON' ? 'Company 2: Ircon International Limited (IRCON)' :
                         `${o.name} (${o.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section 3: Function & Capability */}
              <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Functional Role & Document Capability</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Dropdown 1: Function Designation */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Function (Designation) (*)</label>
                    <select
                      value={userFunction}
                      onChange={(e) => {
                        const func = e.target.value;
                        setUserFunction(func);
                        let cap = documentCapability;
                        if (func === 'Admin' || func === 'Execution Control') {
                          cap = 'Upload';
                        }
                        setDocumentCapability(cap);
                        updateRoleMapping(func, cap, orgId);
                      }}
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Select Function --</option>
                      <option value="Admin">Admin (Company Administration)</option>
                      <option value="Execution Control">Execution Control</option>
                      <option value="Manager">Manager</option>
                      <option value="Document Reviewer">Document Reviewer</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>

                  {/* Dropdown 2: Document Upload and Viewer Rights */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Document Capability (*)</label>
                    <select
                      value={documentCapability}
                      onChange={(e) => {
                        const cap = e.target.value;
                        setDocumentCapability(cap);
                        updateRoleMapping(userFunction, cap, orgId);
                      }}
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Upload">📤 Upload (Upload, Preview & Download)</option>
                      <option value="Viewer">👁️ Viewer (Preview & Download)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Granted Permissions Summary Card */}
              {roleId && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl space-y-2 text-[11px] animate-fadeIn">
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span className="flex items-center space-x-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Assigned Role:</span>
                    </span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-mono">
                      {roles.find(r => r.id === parseInt(roleId))?.name || `Role #${roleId}`}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rolePermissions
                      .filter(rp => rp.role_id === parseInt(roleId))
                      .map(rp => (
                        <span key={rp.permission_id} className="inline-flex items-center space-x-1 px-2 py-0.5 bg-white border border-blue-300 text-blue-800 rounded-md font-semibold text-[10px] shadow-2xs">
                          <Check className="w-3 h-3 text-blue-600" />
                          <span>{rp.code}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Form Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold shadow-sm hover:shadow transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal (Super Admin Only) */}
      {showResetModal && selectedUserForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0 border-b border-slate-700/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">Reset User Password</h3>
                  <p className="text-[11px] text-slate-300">Super Administrator Security Override</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!resetSubmitting) setShowResetModal(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Summary Card */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-3 text-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-black flex items-center justify-center text-sm uppercase shrink-0 border border-blue-200">
                {selectedUserForReset.name ? selectedUserForReset.name.charAt(0) : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{selectedUserForReset.name}</p>
                <p className="text-[11px] text-blue-600 font-mono truncate">{selectedUserForReset.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded text-[10px]">
                    {selectedUserForReset.organization_name || 'Global System'}
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded text-[10px] border border-indigo-200">
                    {selectedUserForReset.designation || selectedUserForReset.role_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4 text-xs">
              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {/* New Password Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  New Password (*)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    required
                    placeholder="Enter new password (min. 6 characters)"
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Confirm New Password (*)
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    required
                    placeholder="Re-type new password"
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                💡 <span className="font-bold">Security Note:</span> Resetting this password takes effect immediately and clears any active login lockouts for this account.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={resetSubmitting}
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting || !newResetPassword || !confirmResetPassword}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {resetSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Set New Password</span>
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
