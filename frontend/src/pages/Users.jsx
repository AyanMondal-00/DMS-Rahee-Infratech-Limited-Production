import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users as UsersIcon, Plus, UserCheck, UserX, Shield, Building2, X, AlertCircle, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function Users() {
  const { user, hasPermission } = useAuth();

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
      setModalError('Please select an Assigned Role.');
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
      setOrgId('');
      fetchUsers();
    } catch (err) {
      setSubmitting(false);
      setModalError(err.response?.data?.message || 'Failed to create user account.');
    }
  };

  const toggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change status of ${targetUser.email} to ${newStatus}?`)) return;

    try {
      await api.patch(`/users/${targetUser.id}/status`, { status: newStatus });
      fetchUsers();
    } catch (err) {
      alert('Failed to update status: ' + (err.response?.data?.message || err.message));
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
    setRoleId('');
    setOrgId('');
    setModalError('');
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organization Users & Access Control</h1>
          <p className="text-xs text-slate-500 mt-1">Manage user accounts, credentials, role assignments, and tenant bindings.</p>
        </div>

        {(user?.is_super_admin || hasPermission('manage_users')) && (
          <button
            onClick={resetCreateForm}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {/* Company Filter Bar for Super Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-800">Filter Users by Organization / Company:</span>
        </div>
        <select
          value={filterOrgId}
          onChange={(e) => setFilterOrgId(e.target.value)}
          className="p-2 border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Companies (Company 1 & Company 2)</option>
          <option value="1">Company 1: Rahee Infratech Limited (RAHEE)</option>
          <option value="2">Company 2: Ircon International Limited (IRCON)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading user registry...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User Name & ID</th>
                  <th className="py-3.5 px-4">Organization</th>
                  <th className="py-3.5 px-4">Function / Designation</th>
                  <th className="py-3.5 px-4">Document Capability</th>
                  <th className="py-3.5 px-4">Password</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {usersList
                  .filter(u => filterOrgId === 'ALL' || (filterOrgId === '1' && (u.organization_id === 1 || u.organization_code === 'RAHEE')) || (filterOrgId === '2' && (u.organization_id === 2 || u.organization_code === 'IRCON')))
                  .map((u) => {
                    const isUploader = u.document_capability === 'Upload' || u.role_name === 'DOCUMENT_UPLOADER' || u.role_name === 'RAHEE_ADMIN' || u.role_name === 'IRCON_ADMIN';
                    return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0">
                            {u.name ? u.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-blue-600 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-semibold">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{u.organization_name || 'Global System'}</span>
                        </span>
                      </td>

                      {/* Function / Designation */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 font-bold rounded-md text-xs border ${
                          (u.designation === 'Super Admin' || u.role_name === 'SUPER_ADMIN')
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : (u.designation === 'Admin' || u.role_name === 'RAHEE_ADMIN' || u.role_name === 'IRCON_ADMIN')
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : (u.designation === 'Execution Control' || u.role_name === 'DOCUMENT_UPLOADER')
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : (u.designation === 'Review' || u.designation === 'Document Reviewer')
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : (u.designation === 'Viewer')
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {u.designation || (u.role_name === 'DOCUMENT_UPLOADER' ? 'Execution Control' : u.role_name === 'SUPER_ADMIN' ? 'Super Admin' : u.role_name === 'RAHEE_ADMIN' || u.role_name === 'IRCON_ADMIN' ? 'Admin' : 'Manager')}
                        </span>
                      </td>

                      {/* Document Capability */}
                      <td className="py-3.5 px-4">
                        {isUploader && u.role_name !== 'SUPER_ADMIN' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-cyan-50 text-cyan-800 font-bold rounded-md text-xs border border-cyan-200">
                            <span>📤 Upload</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-md text-xs border border-slate-200">
                            <span>👁️ Viewer</span>
                          </span>
                        )}
                      </td>

                      {/* Password Action Column */}
                      <td className="py-3.5 px-4">
                        {user?.is_super_admin && (
                          <button
                            type="button"
                            onClick={() => handleOpenResetModal(u)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] shadow-2xs transition active:scale-95"
                            title={`Reset password for ${u.name}`}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Password</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>

                    <td className="py-3.5 px-4 text-right">
                      {(user?.is_super_admin || hasPermission('manage_users')) && u.role_name !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition ${
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">Create New User Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name (*)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address / User ID (*)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="rahul@raheeinfratech.com"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password (*)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              {(user?.is_super_admin || orgs.length > 0) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company / Tenant Organization (*)</label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
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

              {/* Dropdown 1: Function Designation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Function (Designation) (*)</label>
                <select
                  value={userFunction}
                  onChange={(e) => {
                    const func = e.target.value;
                    setUserFunction(func);
                    // Default capability based on function selection
                    let cap = 'Viewer';
                    if (func === 'Admin' || func === 'Execution Control') cap = 'Upload';
                    setDocumentCapability(cap);

                    // Auto-resolve roleId
                    if (func === 'Admin') {
                      setRoleId((parseInt(orgId) === 2 || orgId === '2') ? '8' : '2');
                    } else if (func === 'Execution Control' && cap === 'Upload') {
                      setRoleId('7');
                    } else {
                      setRoleId('6');
                    }
                  }}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Function Designation --</option>
                  <option value="Admin">Admin (Company Administration)</option>
                  <option value="Execution Control">Execution Control</option>
                  <option value="Manager">Manager</option>
                  <option value="Document Reviewer">Document Reviewer</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              {/* Dropdown 2: Document Upload and Viewer Rights */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Upload and Viewer (*)</label>
                <select
                  value={documentCapability}
                  onChange={(e) => {
                    const cap = e.target.value;
                    setDocumentCapability(cap);
                    if (userFunction === 'Admin') {
                      setRoleId((parseInt(orgId) === 2 || orgId === '2') ? '8' : '2');
                    } else if (userFunction === 'Execution Control' && cap === 'Upload') {
                      setRoleId('7');
                    } else {
                      setRoleId('6');
                    }
                  }}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Upload">📤 Upload (Upload, Preview & Download)</option>
                  <option value="Viewer">👁️ Viewer (Preview & Download)</option>
                </select>
              </div>

              {/* Granted Permissions Summary Badge List */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-bold text-blue-900 flex items-center justify-between">
                  <span>Granted Permissions for Active Role:</span>
                  <span className="text-[10px] text-blue-700 font-mono font-normal">
                    {roles.find(r => r.id === parseInt(roleId))?.name}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {rolePermissions
                    .filter(rp => rp.role_id === parseInt(roleId))
                    .map(rp => (
                      <span key={rp.permission_id} className="px-2 py-0.5 bg-white border border-blue-300 text-blue-800 rounded font-semibold text-[10px] shadow-2xs">
                        ✓ {rp.code}
                      </span>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal (Super Admin Only) */}
      {showResetModal && selectedUserForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">Reset User Password</h3>
                  <p className="text-[11px] text-slate-400">Super Administrator Override</p>
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
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

