import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Documents from '../pages/Documents';
import UploadDocument from '../pages/UploadDocument';
import DocumentDetail from '../pages/DocumentDetail';
import Reviews from '../pages/Reviews';
import Users from '../pages/Users';
import Organizations from '../pages/Organizations';
import EmailActivity from '../pages/EmailActivity';
import AuditLogs from '../pages/AuditLogs';
import Reports from '../pages/Reports';
import RecycleBin from '../pages/RecycleBin';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/upload" element={<UploadDocument />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/users" element={<Users />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/recycle-bin" element={<RecycleBin />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/emails" element={<EmailActivity />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
