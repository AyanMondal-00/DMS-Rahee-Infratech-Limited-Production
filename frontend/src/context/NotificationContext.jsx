import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { CheckCircle, AlertTriangle, XCircle, Info, HelpCircle, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import api, { SOCKET_URL } from '../services/api';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailLogs, setEmailLogs] = useState([]);
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Custom in-app modal state for Alerts and Confirms
  const [alertState, setAlertState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  // Fetch initial notifications & email logs from backend
  const refreshNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }

      const emailRes = await api.get('/notifications/emails');
      if (emailRes.data.success) {
        setEmailLogs(emailRes.data.emailLogs);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      if (socket) socket.disconnect();
      return;
    }

    refreshNotifications();

    // Initialize Socket.IO connection using environment-configured URL
    const newSocket = io(SOCKET_URL || undefined);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_user_room', user.id);
    });

    // Listen for in-app real-time notifications
    newSocket.on('new_notification', (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast alert
      setToast({
        title: newNotif.title,
        message: newNotif.message,
        type: newNotif.type
      });

      setTimeout(() => setToast(null), 5000);
    });

    // Listen for live email activity updates
    newSocket.on('email_activity', (emailEvent) => {
      setEmailLogs(prev => [emailEvent, ...prev]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Custom Promise-based Alert Card Pop-Up (Replaces browser alert)
  const showAlert = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    const type = opts.type || 'info';
    const defaultTitle = 
      type === 'error' ? 'Action Failed' :
      type === 'success' ? 'Success' :
      type === 'warning' ? 'Attention' : 'Notice';

    return new Promise((resolve) => {
      setAlertState({
        title: opts.title || defaultTitle,
        message: opts.message || '',
        type,
        onClose: () => {
          setAlertState(null);
          resolve(true);
        }
      });
    });
  }, []);

  // Custom Promise-based Confirm Card Pop-Up (Replaces browser confirm)
  const showConfirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      setConfirmState({
        title: opts.title || 'Please Confirm',
        message: opts.message || 'Are you sure you want to proceed?',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        isDanger: opts.isDanger !== undefined ? opts.isDanger : true,
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(null);
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      emailLogs,
      toast,
      setToast,
      markAsRead,
      markAllAsRead,
      refreshNotifications,
      showAlert,
      showConfirm
    }}>
      {children}

      {/* Real-Time Toast Alert Pop-Up Overlay */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900/95 backdrop-blur text-white p-4 rounded-2xl shadow-2xl border border-blue-500/40 flex items-start space-x-3 transition-all transform animate-bounce">
          <div className={`p-2.5 rounded-xl text-white font-bold flex items-center justify-center shrink-0 ${
            toast.type?.includes('REJECT') ? 'bg-rose-600' :
            toast.type?.includes('APPROVED') || toast.type?.includes('FINAL') ? 'bg-emerald-600' : 'bg-blue-600'
          }`}>
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-white tracking-wide">{toast.title}</h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
            <span className="text-[9px] text-blue-400 mt-1 block font-mono">Real-Time In-App Alert</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern In-App Custom Alert Pop-up Modal */}
      {alertState && (
        <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 transform transition-all scale-100">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${
                alertState.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600' :
                alertState.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' :
                alertState.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600' :
                'bg-blue-50 dark:bg-blue-950/50 text-blue-600'
              }`}>
                {alertState.type === 'error' && <XCircle className="w-6 h-6" />}
                {alertState.type === 'success' && <CheckCircle className="w-6 h-6" />}
                {alertState.type === 'warning' && <AlertTriangle className="w-6 h-6" />}
                {alertState.type === 'info' && <Info className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{alertState.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">{alertState.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={alertState.onClose}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm hover:shadow active:scale-98"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern In-App Custom Confirm Pop-up Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 transform transition-all scale-100">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${
                confirmState.isDanger ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600'
              }`}>
                {confirmState.isDanger ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{confirmState.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">{confirmState.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={confirmState.onCancel}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition"
              >
                {confirmState.cancelText}
              </button>
              <button
                onClick={confirmState.onConfirm}
                className={`px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition shadow-sm hover:shadow active:scale-98 ${
                  confirmState.isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
