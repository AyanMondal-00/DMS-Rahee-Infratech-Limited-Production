import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Users, 
  Building2, 
  Mail, 
  ShieldCheck, 
  Trash2 
} from 'lucide-react';

export default function Sidebar() {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin || user?.role_id === 1 || user?.email === 'rajib.g@rahee.com';
  const isSystemOrCompanyAdmin = isSuperAdmin || [1, 2, 8].includes(user?.role_id) || user?.email === 'rahul.d@rahee.com' || hasPermission('manage_users');

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/documents', label: 'Document Repository', icon: FileText, show: true },
    { to: '/reviews', label: 'Workflow Reviews', icon: CheckSquare, show: false },
    { to: '/users', label: 'Users & Roles', icon: Users, show: isSuperAdmin },
    { to: '/organizations', label: 'Tenant Organizations', icon: Building2, show: isSuperAdmin },
    { to: '/recycle-bin', label: 'Recycle Bin', icon: Trash2, show: isSuperAdmin },
    { to: '/emails', label: 'Email Outbox Logs', icon: Mail, show: true },
    { to: '/audit-logs', label: 'System Audit Logs', icon: ShieldCheck, show: true }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-full p-4 flex flex-col justify-between border-r border-slate-800 shrink-0 select-none overflow-y-auto z-20">
      <div className="space-y-6">

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
    
    </aside>
  );
}
