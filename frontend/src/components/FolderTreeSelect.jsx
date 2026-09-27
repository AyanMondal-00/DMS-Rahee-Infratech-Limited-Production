import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Check, 
  Search, 
  Layers, 
  ChevronsUpDown,
  Building2,
  Shield
} from 'lucide-react';
import { getFolderTreeNodes } from '../utils/folderUtils';

export default function FolderTreeSelect({
  folders = [],
  selectedFolderId = '',
  onSelect,
  branchName = null,
  placeholder = 'Select Folder...',
  allowAll = false,
  allLabel = 'All Folders',
  disabled = false,
  className = '',
  dropdownClassName = '',
  error = false,
  compact = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState(new Set());
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Build hierarchical tree structure
  const treeNodes = useMemo(() => {
    return getFolderTreeNodes(folders, branchName);
  }, [folders, branchName]);

  // Total documents across visible tree
  const totalTreeDocCount = useMemo(() => {
    return treeNodes.reduce((acc, node) => acc + (node.document_count || 0), 0);
  }, [treeNodes]);

  // Find currently selected folder object and compute full path trail
  const selectedFolderObj = useMemo(() => {
    if (!selectedFolderId) return null;
    const targetId = parseInt(selectedFolderId);
    return folders.find(f => f.id === targetId) || null;
  }, [folders, selectedFolderId]);

  // Compute map of parent IDs for auto-expanding selected branch
  const findParentIds = (nodes, targetId, currentPath = []) => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return currentPath;
      }
      if (node.children && node.children.length > 0) {
        const found = findParentIds(node.children, targetId, [...currentPath, node.id]);
        if (found) return found;
      }
    }
    return null;
  };

  // Initialize and preserve expanded state: ensure roots and selected parent path are included without collapsing user-expanded subfolders
  useEffect(() => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      // Ensure root nodes are expanded
      treeNodes.forEach(node => {
        next.add(node.id);
      });

      // Also ensure parents of selected folder are expanded
      if (selectedFolderId) {
        const parentIds = findParentIds(treeNodes, parseInt(selectedFolderId));
        if (parentIds) {
          parentIds.forEach(id => next.add(id));
        }
      }

      return next;
    });
  }, [treeNodes, selectedFolderId]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleExpand = (nodeId, e) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = (e) => {
    e.stopPropagation();
    const allIds = new Set();
    const collectIds = (nodes) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        if (n.children && n.children.length > 0) collectIds(n.children);
      });
    };
    collectIds(treeNodes);
    setExpandedNodeIds(allIds);
  };

  const handleCollapseAll = (e) => {
    e.stopPropagation();
    setExpandedNodeIds(new Set());
  };

  const handleSelectNode = (node) => {
    if (onSelect) {
      onSelect(node.id.toString(), node);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectAllOption = () => {
    if (onSelect) {
      onSelect('', null);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Filter tree nodes if search query is entered
  const filterNodes = (nodes, query) => {
    if (!query) return nodes;
    const lower = query.toLowerCase();

    const filterList = (items) => {
      const result = [];
      for (const item of items) {
        const matchesSelf = item.name.toLowerCase().includes(lower) || (item.path && item.path.toLowerCase().includes(lower));
        const filteredChildren = item.children && item.children.length > 0 ? filterList(item.children) : [];

        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...item,
            children: filteredChildren,
            forceExpanded: true
          });
        }
      }
      return result;
    };

    return filterList(nodes);
  };

  const visibleTreeNodes = useMemo(() => {
    return filterNodes(treeNodes, searchQuery);
  }, [treeNodes, searchQuery]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = searchQuery ? true : expandedNodeIds.has(node.id);
    const isSelected = selectedFolderId && parseInt(selectedFolderId) === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => handleSelectNode(node)}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2.5 my-0.5 rounded-lg text-xs cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200 shadow-2xs' 
              : 'text-slate-700 hover:bg-slate-100/90 font-medium'
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            {/* Expand / Collapse Chevron Toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded transition p-0.5"
                title={isExpanded ? 'Collapse subfolders' : 'Expand subfolders'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 transition-transform duration-150" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform duration-150" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 inline-flex items-center justify-center text-slate-300 text-[10px]">
                •
              </span>
            )}

            {/* Folder Icon (VS Code Explorer Aesthetic) */}
            <div className="shrink-0">
              {isExpanded || isSelected ? (
                <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-amber-500'}`} />
              ) : (
                <Folder className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-amber-600'}`} />
              )}
            </div>

            {/* Folder Name */}
            <span className={`truncate text-xs ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-800'}`}>
              {node.name}
            </span>

            {/* Operational Tag */}
            {node.is_operational ? (
              <span className="shrink-0 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded border border-amber-200">
                🛡️
              </span>
            ) : null}
          </div>

          {/* Right-side Document Count Pill & Selection Checkmark */}
          <div className="flex items-center space-x-1.5 shrink-0 pl-2">
            {typeof node.document_count === 'number' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                isSelected ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>
                {node.document_count}
              </span>
            )}
            {isSelected && (
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )}
          </div>
        </div>

        {/* Render child subfolders if expanded */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Guide line for tree depth */}
            <div 
              className="absolute top-0 bottom-1 border-l border-slate-200" 
              style={{ left: `${depth * 18 + 15}px` }} 
            />
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      
      {/* Trigger Box (Dropdown Button with Down Arrow on Right) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-xs border rounded-lg bg-white transition text-left ${
          compact ? 'h-7 px-2 py-0' : 'px-3 py-2 rounded-xl shadow-2xs'
        } ${
          error ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300 hover:border-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-1">
          {selectedFolderObj ? (
            <>
              <FolderOpen className={`${compact ? 'w-3 h-3 text-amber-500' : 'w-3.5 h-3.5 text-amber-600'} shrink-0`} />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-slate-900 truncate block text-[11px] leading-tight">
                  {selectedFolderObj.name}
                </span>
              </div>
              {selectedFolderObj.is_operational ? (
                <span className="text-[10px] shrink-0" title="Operational Folder">
                  🛡️
                </span>
              ) : null}
            </>
          ) : (
            <div className="flex items-center space-x-1.5 text-slate-700 font-medium truncate text-[11px]">
              <Folder className={`${compact ? 'w-3 h-3 text-slate-400' : 'w-3.5 h-3.5 text-slate-500'} shrink-0`} />
              <span className="truncate">
                {allowAll ? allLabel : placeholder}
              </span>
            </div>
          )}
        </div>

        {/* Down Arrow (Expand / Collapse Indicator on Right Side) */}
        <div className="shrink-0 text-slate-400">
          <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Tree View */}
      {isOpen && (
        <div className={`absolute z-50 mt-1.5 w-full min-w-[280px] max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn ${dropdownClassName}`}>
          
          {/* Header Controls: Search & Expand/Collapse All */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search folder structure..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={handleExpandAll}
                title="Expand All Folders"
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-[11px] font-semibold transition"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                title="Collapse All Folders"
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-[11px] font-semibold transition"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tree View Container */}
          <div className="p-2 max-h-64 overflow-y-auto overflow-x-hidden space-y-0.5 text-xs divide-y divide-slate-50">
            
            {/* "All Folders" Option if enabled */}
            {allowAll && !searchQuery && (
              <div
                onClick={handleSelectAllOption}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition mb-1 ${
                  !selectedFolderId 
                    ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200' 
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  <span>📁 {allLabel}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold font-mono">
                    {totalTreeDocCount}
                  </span>
                  {!selectedFolderId && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
              </div>
            )}

            {/* Tree Nodes List */}
            {visibleTreeNodes.length > 0 ? (
              visibleTreeNodes.map(node => renderTreeNode(node, 0))
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs italic">
                {searchQuery ? `No folders match "${searchQuery}"` : 'No folders available'}
              </div>
            )}

          </div>

          {/* Footer Status Bar */}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            
            <span>{folders.length} total directories</span>
          </div>

        </div>
      )}

    </div>
  );
}


