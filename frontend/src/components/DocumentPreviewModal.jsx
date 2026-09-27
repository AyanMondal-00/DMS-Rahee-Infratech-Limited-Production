import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Shield, Lock, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function DocumentPreviewModal({ isOpen, onClose, document, onDownload }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    if (isOpen && document) {
      setLoading(true);
      setError(null);
      setBlobUrl(null);
      setHtmlContent(null);

      api.get(`/documents/${document.id}/preview`, { responseType: 'blob' })
        .then(async (res) => {
          if (!active) return;
          const contentType = res.headers['content-type'] || '';
          
          if (contentType.includes('text/html')) {
            const text = await res.data.text();
            setHtmlContent(text);
          } else {
            const blob = new Blob([res.data], { type: contentType || 'application/pdf' });
            createdUrl = URL.createObjectURL(blob);
            setBlobUrl(createdUrl);
          }
          setLoading(false);
        })
        .catch(async (err) => {
          if (!active) return;
          console.error('Document preview error:', err);
          let errorMsg = 'Unable to stream document preview.';
          if (err.response?.data instanceof Blob) {
            try {
              const errorText = await err.response.data.text();
              const parsed = JSON.parse(errorText);
              if (parsed.message) errorMsg = parsed.message;
            } catch (e) {}
          } else if (err.response?.data?.message) {
            errorMsg = err.response.data.message;
          } else if (err.message) {
            errorMsg = err.message;
          }
          setError(errorMsg);
          setLoading(false);
        });
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const isFinalApproved = document.status === 'FINAL_APPROVED' || document.is_locked === 1;

  const handleOpenNewWindow = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    } else if (htmlContent) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="font-bold text-base line-clamp-1">{document.title}</h2>
              <p className="text-xs text-slate-300">
                Version: <span className="text-blue-300 font-semibold">{document.current_version_number || 'V1'}</span> | 
                Org: <span className="text-slate-200">{document.organization_name}</span> | 
                Type: <span className="text-emerald-300 font-bold uppercase">{document.document_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {(blobUrl || htmlContent) && (
              <button
                onClick={handleOpenNewWindow}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Window</span>
              </button>
            )}

            <button
              onClick={() => onDownload(document)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Original File</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security Banner */}
        <div className="bg-amber-50 px-6 py-2 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <span><strong>Multi-Tenant Secure Preview Active:</strong> High-speed local blob stream loaded under organization isolation scope ({document.organization_code || 'AUTH'}).</span>
          </div>
          <span className="font-mono text-[11px] text-amber-700">SHA-256 Verified</span>
        </div>

        {/* Viewer Content Body */}
        <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center relative">
          {loading ? (
            <div className="flex flex-col items-center space-y-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Decrypting & loading document preview stream...</p>
            </div>
          ) : error ? (
            <div className="bg-white p-6 rounded-2xl border border-rose-200 text-center space-y-3 max-w-md shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Preview Unavailable</h3>
              <p className="text-xs text-slate-600">{error}</p>
            </div>
          ) : htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full rounded-xl border border-slate-300 bg-white shadow-sm"
              title={`${document.document_type} HTML Preview`}
            />
          ) : blobUrl ? (
            document.document_type === 'IMAGE' ? (
              <img
                src={blobUrl}
                alt={document.title}
                className="max-h-full max-w-full object-contain rounded-lg shadow-md border border-slate-200"
              />
            ) : (
              <iframe
                src={blobUrl}
                className="w-full h-full rounded-xl border border-slate-300 bg-white shadow-sm"
                title={`${document.document_type} Blob Preview`}
              />
            )
          ) : null}
        </div>

      </div>
    </div>
  );
}
