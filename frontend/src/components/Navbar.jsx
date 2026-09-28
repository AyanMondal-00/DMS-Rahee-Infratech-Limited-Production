import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Bell, Mail, LogOut, ShieldAlert, Building2, User, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, emailLogs } = useNotification();
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
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-extrabold px-1 min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                {emailLogs.length > 99 ? '99+' : emailLogs.length}
              </span>
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
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs">Workflow Notifications</span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded-full font-mono">
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2.5">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-blue-300 hover:text-blue-200 hover:underline transition"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-rose-300 hover:text-rose-200 hover:underline flex items-center gap-1 transition"
                        title="Clear all notifications"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition group flex items-start justify-between gap-2 ${
                          Number(n.is_read) === 0 ? 'bg-blue-50/60 font-semibold' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 font-bold">{n.title}</p>
                          <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 opacity-70 group-hover:opacity-100"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
