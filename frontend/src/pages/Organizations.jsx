import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { 
  Building2, 
  Plus, 
  X, 
  AlertCircle, 
  ShieldCheck, 
  Users, 
  FileText, 
  FolderTree, 
  Trash2, 
  CheckCircle2, 
  Power,
  Layers,
  HardDrive
} from 'lucide-react';

export default function Organizations() {
  const { showAlert, showConfirm } = useNotification();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/organizations');
      if (res.data.success) {
        setOrgs(res.data.organizations);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Company / Tenant name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/organizations', { 
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined
      });
      setSubmitting(false);
      setShowModal(false);
      setName('');
      setCode('');
      showAlert({
        title: 'Tenant Registered Successfully',
        message: `Organization "${name.trim()}" and its root directory branch have been provisioned.`,
        type: 'success'
      });
      fetchOrgs();
    } catch (err) {
      setSubmitting(false);
      setError(err.response?.data?.message || 'Failed to create organization.');
    }
  };

  const toggleStatus = async (org) => {
    const newStatus = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmed = await showConfirm({
      title: 'Update Tenant Status',
      message: `Are you sure you want to change the status of "${org.name}" to ${newStatus}?`,
      confirmText: `Set ${newStatus}`,
      isDanger: newStatus === 'INACTIVE'
    });

    if (!confirmed) return;

    try {
      await api.patch(`/organizations/${org.id}/status`, { status: newStatus });
      showAlert({
        title: 'Status Updated',
        message: `"${org.name}" status changed to ${newStatus}.`,
        type: 'success'
      });
      fetchOrgs();
    } catch (err) {
      showAlert({
        title: 'Operation Failed',
        message: 'Failed to update tenant status: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const handleDelete = async (org) => {
    const confirmed = await showConfirm({
      title: `Delete Tenant: ${org.name}`,
      message: `Are you sure you want to delete "${org.name}" (${org.code})? Associated documents and user accounts will be archived/disabled. This action cannot be undone.`,
      confirmText: 'Delete Organization',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      const res = await api.delete(`/organizations/${org.id}`);
      showAlert({
        title: 'Tenant Deleted',
        message: res.data?.message || `Organization "${org.name}" has been deleted successfully.`,
        type: 'success'
      });
      fetchOrgs();
    } catch (err) {
      showAlert({
        title: 'Deletion Failed',
        message: err.response?.data?.message || err.message || 'Failed to delete organization.',
        type: 'error'
      });
    }
  };

  const totalActive = orgs.filter(o => o.status === 'ACTIVE').length;
  const totalUsers = orgs.reduce((acc, o) => acc + (parseInt(o.total_users) || 0), 0);
  const totalDocs = orgs.reduce((acc, o) => acc + (parseInt(o.total_documents) || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-600/10 text-blue-600 rounded-2xl border border-blue-200/60">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Tenant Organizations</h1>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Multi-Tenant Isolation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Super Administrator Multi-Tenant Directory Isolation & Corporate Governance Console.</p>
          </div>
        </div>

        <button
          onClick={() => {
            setName('');
            setCode('');
            setError('');
            setShowModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition active:scale-98 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Tenant</span>
        </button>
      </div>

      {/* Top Level Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tenants</p>
            <p className="text-xl font-black text-slate-900">{orgs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
            <p className="text-xl font-black text-emerald-600">{totalActive} / {orgs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Users</p>
            <p className="text-xl font-black text-blue-600">{totalUsers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Documents</p>
            <p className="text-xl font-black text-amber-600">{totalDocs}</p>
          </div>
        </div>
      </div>

      {/* Grid of Enterprise Tenant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full p-16 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            Loading enterprise tenant directories...
          </div>
        ) : (
          orgs.map((o) => {
            const isRahee = o.id === 1 || o.code === 'RAHEE';
            const isIrcon = o.id === 2 || o.code === 'IRCON';
            const isActive = o.status === 'ACTIVE';

            return (
              <div 
                key={o.id} 
                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  isRahee ? 'border-blue-200 hover:border-blue-400' :
                  isIrcon ? 'border-emerald-200 hover:border-emerald-400' :
                  'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Top Accent Bar */}
                <div className={`h-2 w-full ${
                  isRahee ? 'bg-gradient-to-r from-blue-600 to-indigo-600' :
                  isIrcon ? 'bg-gradient-to-r from-emerald-600 to-teal-600' :
                  'bg-gradient-to-r from-slate-600 to-slate-800'
                }`} />

                <div className="p-6 space-y-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3.5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 border ${
                        isRahee ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        isIrcon ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-black text-slate-900 text-lg tracking-tight">{o.name}</h3>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${
                            isRahee ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            isIrcon ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            Code: {o.code}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">ID: #{o.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span>{o.status}</span>
                    </span>
                  </div>

                  {/* Tenant Isolation Feature Badge */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center space-x-2.5 text-xs text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium text-[11px]">
                      Tenant Isolation: Dedicated branch folder & security boundaries under Central Bikramshila
                    </span>
                  </div>

                  {/* Metrics Statistics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 text-center">
                      <div className="flex items-center justify-center space-x-1 text-slate-500 text-[11px] font-bold mb-1">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>Users</span>
                      </div>
                      <p className="text-base font-black text-slate-900">{o.total_users || 0}</p>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 text-center">
                      <div className="flex items-center justify-center space-x-1 text-slate-500 text-[11px] font-bold mb-1">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        <span>Docs</span>
                      </div>
                      <p className="text-base font-black text-slate-900">{o.total_documents || 0}</p>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 text-center">
                      <div className="flex items-center justify-center space-x-1 text-slate-500 text-[11px] font-bold mb-1">
                        <FolderTree className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Folders</span>
                      </div>
                      <p className="text-base font-black text-slate-900">{o.total_folders || 0}</p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => toggleStatus(o)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer border ${
                        isActive
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isActive ? 'Deactivate Tenant' : 'Activate Tenant'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(o)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer"
                      title={`Delete ${o.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Tenant</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-400/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Register Enterprise Tenant</h3>
                  <p className="text-[11px] text-slate-300">Create new company workspace and directory</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-2xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Organization Name (*)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Rahee Infratech Limited"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Organization Code (Optional)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RAHEE / IRCON (auto-generated if blank)"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono uppercase font-medium text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">A unique system directory branch under Bikramshila will be created automatically.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {submitting ? 'Provisioning...' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
