const db = require('../config/db');

async function getNotifications(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || 20, 10), 1), 100);
    const offset = Math.max(parseInt(req.query.offset || 0, 10), 0);

    const notifications = await db.query(
      `SELECT n.*, u.name as sender_name 
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.recipient_id = ?
       ORDER BY n.id DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const unreadCountRes = await db.query(
      "SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = ? AND (is_read = 0 OR is_read = '0' OR is_read IS FALSE)",
      [req.user.id]
    );
    const rawCnt = unreadCountRes[0] ? (unreadCountRes[0].cnt !== undefined ? unreadCountRes[0].cnt : unreadCountRes[0]['COUNT(*)']) : 0;
    const unreadCount = parseInt(rawCnt || 0, 10);

    const totalCountRes = await db.query(
      "SELECT COUNT(*) as total FROM notifications WHERE recipient_id = ?",
      [req.user.id]
    );
    const rawTotal = totalCountRes[0] ? (totalCountRes[0].total !== undefined ? totalCountRes[0].total : totalCountRes[0]['COUNT(*)']) : 0;
    const totalCount = parseInt(rawTotal || 0, 10);

    return res.json({
      success: true,
      notifications,
      unreadCount,
      totalCount,
      limit,
      offset,
      hasMore: (offset + notifications.length) < totalCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?', [id, req.user.id]);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function markAllAsRead(req, res) {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Fetch Email Logs (Outbox Activity - Active)
async function getEmailLogs(req, res) {
  try {
    let sql = 'SELECT * FROM email_logs WHERE (is_deleted = 0 OR is_deleted IS NULL)';
    let params = [];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    sql += ' ORDER BY id DESC LIMIT 100';

    const emailLogs = await db.query(sql, params);
    return res.json({ success: true, emailLogs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Fetch Deleted Email Logs (Trash)
async function getDeletedEmailLogs(req, res) {
  try {
    let sql = 'SELECT * FROM email_logs WHERE is_deleted = 1';
    let params = [];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    sql += ' ORDER BY deleted_at DESC, id DESC LIMIT 100';

    const emailLogs = await db.query(sql, params);
    return res.json({ success: true, emailLogs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete a specific notification by ID
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', [id, req.user.id]);
    return res.json({ success: true, message: 'Notification deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Clear / Delete all notifications for the authenticated user
async function clearAllNotifications(req, res) {
  try {
    await db.query('DELETE FROM notifications WHERE recipient_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'All notifications cleared successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete a specific email log by ID (Soft delete -> Trash)
async function deleteEmailLog(req, res) {
  try {
    const { id } = req.params;
    let sql = 'UPDATE email_logs SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
    let params = [id];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'Email log moved to trash successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Clear / Move all active email logs to trash
async function clearAllEmailLogs(req, res) {
  try {
    let sql = 'UPDATE email_logs SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE (is_deleted = 0 OR is_deleted IS NULL)';
    let params = [];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'All email logs moved to trash successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Restore a specific deleted email log
async function restoreEmailLog(req, res) {
  try {
    const { id } = req.params;
    let sql = 'UPDATE email_logs SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1';
    let params = [id];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'Email log restored successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Restore all deleted email logs
async function restoreAllEmailLogs(req, res) {
  try {
    let sql = 'UPDATE email_logs SET is_deleted = 0, deleted_at = NULL WHERE is_deleted = 1';
    let params = [];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'All deleted email logs restored successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Permanently purge a deleted email log
async function permanentDeleteEmailLog(req, res) {
  try {
    const { id } = req.params;
    let sql = 'DELETE FROM email_logs WHERE id = ?';
    let params = [id];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'Email log permanently deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Empty entire email trash
async function emptyEmailTrash(req, res) {
  try {
    let sql = 'DELETE FROM email_logs WHERE is_deleted = 1';
    let params = [];

    if (!req.user.is_super_admin) {
      sql += ' AND recipient_email = ?';
      params.push(req.user.email);
    }

    await db.query(sql, params);
    return res.json({ success: true, message: 'Email trash emptied successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getEmailLogs,
  getDeletedEmailLogs,
  deleteEmailLog,
  clearAllEmailLogs,
  restoreEmailLog,
  restoreAllEmailLogs,
  permanentDeleteEmailLog,
  emptyEmailTrash
};
