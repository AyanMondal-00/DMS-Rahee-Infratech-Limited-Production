import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Bell, Mail, LogOut, ShieldAlert, Building2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, emailLogs } = useNotification();
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md shrink-0 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg">
            DMS
          </div>
          <div>
            <Link to="/dashboard" className="font-bold text-base tracking-tight text-white hover:text-blue-300 transition">
              Enterprise Document Management
            </Link>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Multi-Tenant Secured Architecture</p>
          </div>
        </div>

        {/* Right Nav Items */}
        <div className="flex items-center space-x-4">

          {/* Email Outbox Shortcut */}
          <Link
            to="/emails"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition relative"
            title="Email Activity Log & Outbox"
          >
            <Mail className="w-5 h-5" />
            {emailLogs.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            )}
          </Link>

          {/* In-App Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                const nextState = !showNotifs;
                setShowNotifs(nextState);
                if (nextState && unreadCount > 0) {
                  markAllAsRead();
                }
              }}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
                  <span className="font-bold text-xs">Workflow Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[11px] text-blue-300 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition ${Number(n.is_read) === 0 ? 'bg-blue-50/60 font-semibold' : ''}`}
                      >
                        <p className="text-slate-900 font-bold">{n.title}</p>
                        <p className="text-slate-600 text-[11px] mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="p-6 text-center text-xs text-slate-400">No notifications found.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User & Organization Pill */}
          <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end">
                <span className="font-bold text-xs text-white">{user?.name}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {user?.is_super_admin ? 'Global Super Admin' : (user?.organization_name || 'Organization User')}
              </p>
            </div>

            <button
              onClick={logout}
              className="flex items-center space-x-2 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-800/60 rounded-xl font-bold text-xs transition shadow-sm"
              title="Logout from system"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
