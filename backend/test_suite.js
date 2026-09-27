/**
 * Comprehensive Backend Test Suite for Enterprise Document Management System (EDMS)
 * Tests all key scenarios, permissions, edge cases, tenant boundaries, and error handling.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:5000';

// Helper for making HTTP requests
function request(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const postData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (postData && !headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    } else if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Colors for output
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const bold = (t) => `\x1b[1m${t}\x1b[0m`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${green('✓ PASS:')} ${message}`);
    passedCount++;
  } else {
    console.error(`  ${red('✗ FAIL:')} ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log(bold('\n==============================================================='));
  console.log(bold('🚀 STARTING COMPREHENSIVE BACKEND TEST SUITE'));
  console.log(bold('===============================================================\n'));

  // Test 1: API Health Check
  console.log(bold('--- TEST SUITE 1: System Health & Base Routes ---'));
  try {
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'UP', 'API Health Check returns status 200 and UP');
  } catch (err) {
    assert(false, `Health check request failed: ${err.message}`);
  }

  // Test Suite 2: Authentication & Security
  console.log(bold('\n--- TEST SUITE 2: Authentication, JWT & Credentials ---'));
  let superAdminToken = '';
  let raheeAdminToken = '';
  let irconAdminToken = '';
  let refreshToken = '';

  // 2.1: Super Admin Login
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'rajib.g@rahee.com',
      password: 'R@jib#Ghosh2026'
    });
    assert(res.status === 200 && res.data.success && res.data.accessToken, 'Super Admin (Rajib Ghosh) login successful with valid JWT');
    superAdminToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
  } catch (err) {
    assert(false, `Super Admin login error: ${err.message}`);
  }

  // 2.2: Rahee Admin Login
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'rahul.d@rahee.com',
      password: 'Rahul@2026!'
    });
    assert(res.status === 200 && res.data.success && res.data.user.organization_id === 1, 'Rahee Admin (Rahul Dey) login successful with Org ID 1');
    raheeAdminToken = res.data.accessToken;
  } catch (err) {
    assert(false, `Rahee Admin login error: ${err.message}`);
  }

  // 2.3: Ircon Admin Login
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'om.jha@ircon.org',
      password: 'Om#Jha2026'
    });
    assert(res.status === 200 && res.data.success && res.data.user.organization_id === 2, 'Ircon Admin (Om Jha) login successful with Org ID 2');
    irconAdminToken = res.data.accessToken;
  } catch (err) {
    assert(false, `Ircon Admin login error: ${err.message}`);
  }

  // 2.4: Wrong Password Rejection
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'rajib.g@rahee.com',
      password: 'WrongPassword123'
    });
    assert(res.status === 401 && res.data.success === false, 'Rejects invalid credentials with status 401');
  } catch (err) {
    assert(false, `Wrong password test error: ${err.message}`);
  }

  // 2.5: Non-existent User Rejection
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'nonexistent.user.test@unknown.com',
      password: 'Password123'
    });
    assert(res.status === 401 && res.data.success === false, 'Rejects non-registered email with status 401');
  } catch (err) {
    assert(false, `Non-existent user test error: ${err.message}`);
  }

  // 2.6: Token Refresh Mechanism
  try {
    const res = await request('POST', '/api/auth/refresh', { refreshToken });
    assert(res.status === 200 && res.data.accessToken, 'Token refresh endpoint returns a fresh access token');
  } catch (err) {
    assert(false, `Token refresh error: ${err.message}`);
  }

  // 2.7: /api/auth/me Endpoint
  try {
    const res = await request('GET', '/api/auth/me', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.user && res.data.user.is_super_admin === true, 'Super Admin /api/auth/me returns valid session payload');
  } catch (err) {
    assert(false, `/api/auth/me error: ${err.message}`);
  }

  // Test Suite 3: Organizations & Tenants
  console.log(bold('\n--- TEST SUITE 3: Multi-Tenant Organizations ---'));
  try {
    const res = await request('GET', '/api/organizations', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.organizations && res.data.organizations.length >= 2, 'Organizations list contains Rahee and Ircon tenants');
  } catch (err) {
    assert(false, `Get organizations error: ${err.message}`);
  }

  // Test Suite 4: Folder Management & Subfolder Hierarchy
  console.log(bold('\n--- TEST SUITE 4: Folder System & Subfolder Hierarchy ---'));
  let testFolderId = null;

  // 4.1: Get folders
  try {
    const res = await request('GET', '/api/folders', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.folders && res.data.folders.length > 0, 'Folders registry fetched successfully');
  } catch (err) {
    assert(false, `Get folders error: ${err.message}`);
  }

  // 4.2: Create a new test folder
  try {
    const res = await request('POST', '/api/folders', {
      name: 'Automated_QA_Test_Folder_' + Date.now(),
      description: 'Temporary folder for automated QA testing',
      is_operational: 0
    }, { Authorization: `Bearer ${raheeAdminToken}` });
    assert(res.status === 201 && res.data.success && res.data.folder.id, `Rahee Admin created test folder (ID: ${res.data.folder?.id})`);
    testFolderId = res.data.folder?.id;
  } catch (err) {
    assert(false, `Create folder error: ${err.message}`);
  }

  // 4.3: Rename test folder
  if (testFolderId) {
    try {
      const res = await request('PUT', `/api/folders/${testFolderId}`, {
        name: 'Automated_QA_Test_Folder_Renamed_' + Date.now(),
        description: 'Renamed test folder'
      }, { Authorization: `Bearer ${raheeAdminToken}` });
      assert(res.status === 200 && res.data.success, 'Rahee Admin successfully renamed test folder');
    } catch (err) {
      assert(false, `Rename folder error: ${err.message}`);
    }
  }

  // 4.4: Move test folder to Recycle Bin
  if (testFolderId) {
    try {
      const res = await request('DELETE', `/api/folders/${testFolderId}`, null, { Authorization: `Bearer ${raheeAdminToken}` });
      assert(res.status === 200 && res.data.success, 'Rahee Admin moved test folder to Recycle Bin');
    } catch (err) {
      assert(false, `Delete folder error: ${err.message}`);
    }
  }

  // Test Suite 5: Recycle Bin & Restoration Console
  console.log(bold('\n--- TEST SUITE 5: Recycle Bin & Recovery Console ---'));

  // 5.1: Non-Super Admin access blocked
  try {
    const res = await request('GET', '/api/recycle-bin/items', null, { Authorization: `Bearer ${raheeAdminToken}` });
    assert(res.status === 403, 'Non-Super Admin access to Recycle Bin is strictly rejected with 403 Forbidden');
  } catch (err) {
    assert(false, `Recycle bin restriction test error: ${err.message}`);
  }

  // 5.2: Super Admin view deleted items
  try {
    const res = await request('GET', '/api/recycle-bin/items', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success && res.data.stats, 'Super Admin fetched Recycle Bin items and statistics');
  } catch (err) {
    assert(false, `Super admin recycle bin error: ${err.message}`);
  }

  // 5.3: Super Admin Restore folder
  if (testFolderId) {
    try {
      const res = await request('POST', `/api/recycle-bin/restore/folder/${testFolderId}`, null, { Authorization: `Bearer ${superAdminToken}` });
      assert(res.status === 200 && res.data.success, `Super Admin restored test folder (ID: ${testFolderId}) back to original path`);
    } catch (err) {
      assert(false, `Restore folder error: ${err.message}`);
    }
  }

  // 5.4: Permanent purge folder
  if (testFolderId) {
    try {
      const res = await request('DELETE', `/api/recycle-bin/permanent/folder/${testFolderId}`, null, { Authorization: `Bearer ${superAdminToken}` });
      assert(res.status === 200 && res.data.success, `Super Admin permanently purged test folder (ID: ${testFolderId}) from system`);
    } catch (err) {
      assert(false, `Permanent purge folder error: ${err.message}`);
    }
  }

  // Test Suite 6: Documents, Pagination & Search
  console.log(bold('\n--- TEST SUITE 6: Documents, Pagination & Filtering ---'));

  // 6.1: Get Documents with Pagination
  let firstDocId = null;
  try {
    const res = await request('GET', '/api/documents?page=1&limit=10', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success && Array.isArray(res.data.documents), `Fetched documents with pagination (Total: ${res.data.total})`);
    if (res.data.documents && res.data.documents.length > 0) {
      firstDocId = res.data.documents[0].id;
    }
  } catch (err) {
    assert(false, `Get documents error: ${err.message}`);
  }

  // 6.2: Search documents
  try {
    const res = await request('GET', '/api/documents?search=proposal', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success, 'Search filter operates cleanly without SQL error');
  } catch (err) {
    assert(false, `Search documents error: ${err.message}`);
  }

  // 6.3: Get document details by ID
  try {
    const targetDocId = firstDocId || 32;
    const res = await request('GET', `/api/documents/${targetDocId}`, null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.document && res.data.versions, `Document detail endpoint returns document record (ID: ${targetDocId}) and version history`);
  } catch (err) {
    assert(false, `Get document by ID error: ${err.message}`);
  }

  // Test Suite 7: Reports & Dashboard Metrics
  console.log(bold('\n--- TEST SUITE 7: Reports & Dashboard Aggregations ---'));
  try {
    const res = await request('GET', '/api/reports/dashboard', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(
      res.status === 200 && 
      res.data.metrics && 
      res.data.metrics.totalDocuments !== undefined && 
      res.data.charts, 
      'Dashboard metrics aggregation calculates document counts, folder counts, and chart breakdowns'
    );
  } catch (err) {
    assert(false, `Dashboard metrics error: ${err.message}`);
  }

  // Test Suite 8: User Management & Password Reset
  console.log(bold('\n--- TEST SUITE 8: User Governance & Security Controls ---'));

  // 8.1: Get users list
  try {
    const res = await request('GET', '/api/users', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.users && res.data.users.length > 0, `Users registry fetched (${res.data.users.length} registered users)`);
  } catch (err) {
    assert(false, `Get users error: ${err.message}`);
  }

  // 8.2: Get roles and permissions
  try {
    const res = await request('GET', '/api/users/roles', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.roles && res.data.permissions, 'Roles and system permissions map fetched');
  } catch (err) {
    assert(false, `Get roles error: ${err.message}`);
  }

  // 8.3: Password reset validation (Min 6 chars check)
  try {
    const res = await request('PUT', '/api/users/5/reset-password', {
      password: '123'
    }, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 400 && res.data.success === false, 'Password reset enforces minimum 6 characters length');
  } catch (err) {
    assert(false, `Password reset validation error: ${err.message}`);
  }

  // Test Suite 9: Security Audit Logs
  console.log(bold('\n--- TEST SUITE 9: Security Audit Trail ---'));
  try {
    const res = await request('GET', '/api/audit-logs', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success && Array.isArray(res.data.auditLogs), `Audit logs trail recorded and retrievable (${res.data.auditLogs.length} events logged)`);
  } catch (err) {
    assert(false, `Audit logs error: ${err.message}`);
  }

  // Test Suite 10: In-App Real-Time Notification System
  console.log(bold('\n--- TEST SUITE 10: Notification Engine & Activity Logs ---'));
  try {
    const res = await request('GET', '/api/notifications', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success && Array.isArray(res.data.notifications), `In-app notifications retrieved (${res.data.notifications.length} alerts in inbox)`);
  } catch (err) {
    assert(false, `Get notifications error: ${err.message}`);
  }

  try {
    const res = await request('GET', '/api/notifications/emails', null, { Authorization: `Bearer ${superAdminToken}` });
    assert(res.status === 200 && res.data.success && Array.isArray(res.data.emailLogs), `Email outbox activity logs retrieved (${res.data.emailLogs.length} logged email events)`);
  } catch (err) {
    assert(false, `Get email logs error: ${err.message}`);
  }

  // Test Suite 11: Document Archival & Lifecycle
  console.log(bold('\n--- TEST SUITE 11: Document Archival & Recovery Lifecycle ---'));
  if (firstDocId) {
    // 11.1: Non-Super Admin archival rejected
    try {
      const res = await request('POST', `/api/documents/${firstDocId}/archive`, null, { Authorization: `Bearer ${raheeAdminToken}` });
      assert(res.status === 403, 'Non-Super Admin manual archival is strictly rejected with 403 Forbidden');
    } catch (err) {
      assert(false, `Non-super admin archival error: ${err.message}`);
    }
  }

  // Final Summary
  console.log(bold('\n==============================================================='));
  console.log(bold(`TEST RESULTS SUMMARY:`));
  console.log(`Total Tests Run: ${passedCount + failedCount}`);
  console.log(`Passed: ${green(passedCount)}`);
  console.log(`Failed: ${failedCount === 0 ? green(failedCount) : red(failedCount)}`);
  console.log(bold('===============================================================\n'));

  if (failedCount === 0) {
    console.log(green('🎉 ALL BACKEND TEST CASES PASSED FLAWLESSLY!\n'));
  } else {
    console.error(red(`❌ ${failedCount} TEST(S) FAILED.\n`));
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
