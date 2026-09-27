import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, Plus, X, AlertCircle, ShieldCheck } from 'lucide-react';

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
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
      await api.post('/organizations', { name: name.trim() });
      setSubmitting(false);
      setShowModal(false);
      setName('');
      fetchOrgs();
    } catch (err) {
      setSubmitting(false);
      setError(err.response?.data?.message || 'Failed to create organization.');
    }
  };

  const toggleStatus = async (org) => {
    const newStatus = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change status of ${org.name} to ${newStatus}?`)) return;

    try {
      await api.patch(`/organizations/${org.id}/status`, { status: newStatus });
      fetchOrgs();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenant Organizations Management</h1>
          <p className="text-xs text-slate-500 mt-1">Super Admin Multi-Tenant Configuration Panel.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tenant Organization</span>
        </button>
      </div>

      {/* Grid of Orgs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 text-center text-xs text-slate-500">Loading tenants...</div>
        ) : (
          orgs.map((o) => (
            <div key={o.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  o.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {o.status}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">{o.name}</h3>
                <p className="text-xs text-blue-600 font-mono font-bold mt-0.5">Org Code: {o.code}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[10px]">ID: #{o.id}</span>
                <button
                  onClick={() => toggleStatus(o)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                >
                  Set {o.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Register New Tenant</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 font-semibold rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Tenant Name (*)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Rahee Infratech Limited"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">A unique system identifier and primary project directory will be generated automatically.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {submitting ? 'Registering...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
