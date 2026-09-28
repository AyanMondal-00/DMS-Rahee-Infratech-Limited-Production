import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Bell, Mail, LogOut, ShieldAlert, Building2, User, Trash2, ChevronDown, CheckCheck, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    totalCount,
    currentLimit,
    loadingNotifs,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    fetchNotifications,
    loadViewAll,
    emailLogs
  } = useNotification();
  const [showNotifs, setShowNotifs] = useState(false);
  const [loadingViewAll, setLoadingViewAll] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  // Close notification dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    if (showNotifs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifs]);

  const handleToggleNotifs = () => {
    const nextState = !showNotifs;
    setShowNotifs(nextState);
    if (nextState) {
      // Whenever notification box is opened, fetch 1st 20 from database API
      fetchNotifications({ limit: 20, offset: 0 });
    }
  };

  const handleViewAll = async () => {
    try {
      setLoadingViewAll(true);
      // Fetch up to 50 notifications directly from DB API
      await loadViewAll(50);
      setLoadingViewAll(false);
    } catch (err) {
      console.error(err);
      setLoadingViewAll(false);
    }
  };

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
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleToggleNotifs}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition relative"
              title="Workflow Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-96 sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs">Workflow Notifications</span>
                    {totalCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-full font-mono font-bold">
                        {notifications.length} of {totalCount}
                      </span>
                    ) : notifications.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-mono">
                        {notifications.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center space-x-2.5">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline transition font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 transition font-semibold"
                        title="Clear all notifications"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications List Body */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {loadingNotifs && notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p>Loading notifications from database...</p>
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition group flex items-start justify-between gap-2.5 ${
                          Number(n.is_read) === 0 ? 'bg-blue-50/70 font-semibold' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5">
                            {Number(n.is_read) === 0 && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            )}
                            <p className="text-slate-900 font-bold text-xs truncate">{n.title}</p>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed break-words">{n.message}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                            {n.sender_name && (
                              <span className="text-blue-600 font-medium">By {n.sender_name}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 opacity-60 group-hover:opacity-100"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="p-8 text-center text-xs text-slate-400">No notifications found.</p>
                  )}
                </div>

                {/* Footer: View All (Load 50 Notifications from Database) */}
                {notifications.length > 0 && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Loaded <strong className="text-slate-800 font-bold">{notifications.length}</strong> {totalCount > 0 ? `of ${totalCount}` : ''}
                    </span>
                    {currentLimit < 50 && totalCount > notifications.length ? (
                      <button
                        type="button"
                        onClick={handleViewAll}
                        disabled={loadingViewAll || loadingNotifs}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-[11px] shadow-xs transition cursor-pointer disabled:opacity-60"
                        title="Load up to 50 recent notifications from database"
                      >
                        {loadingViewAll ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading 50...</span>
                          </>
                        ) : (
                          <>
                            <span>View All (Load 50)</span>
                            <span className="font-mono text-[10px] bg-blue-700/80 px-1 rounded">50</span>
                          </>
                        )}
                      </button>
                    ) : currentLimit < 50 ? (
                      <button
                        type="button"
                        onClick={handleViewAll}
                        disabled={loadingViewAll || loadingNotifs}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-bold rounded-xl text-[11px] transition cursor-pointer disabled:opacity-60"
                        title="Refresh & fetch last 50 notifications from database"
                      >
                        {loadingViewAll ? (
                          <>
                            <div className="w-3 h-3 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading 50...</span>
                          </>
                        ) : (
                          <>
                            <span>View All (50)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Showing last {notifications.length} from DB
                      </span>
                    )}
                  </div>
                )}
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
