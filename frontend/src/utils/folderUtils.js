// Helper to format flat folder array into hierarchical tree representation for dropdowns
export function getFormattedFolderList(folders, branchName = null) {
  if (!folders || !Array.isArray(folders)) return [];
  const map = {};
  folders.forEach(f => {
    map[f.id] = { 
      ...f, 
      children: [], 
      direct_document_count: f.document_count || 0, 
      document_count: f.document_count || 0 
    };
  });

  const roots = [];
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) {
      map[f.parent_id].children.push(map[f.id]);
    } else {
      roots.push(map[f.id]);
    }
  });

  // Calculate cumulative document count rollup (sum of direct documents + all child subfolder documents)
  function calculateCumulativeCounts(node) {
    let total = node.direct_document_count || 0;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        total += calculateCumulativeCounts(child);
      }
    }
    node.document_count = total;
    return total;
  }

  roots.forEach(root => calculateCumulativeCounts(root));

  // If a specific company branch is requested (e.g. 'RAHEE' or 'IRCON'), isolate starting from that branch node
  let startingNodes = [];
  if (branchName) {
    const targetBranchUpper = branchName.toUpperCase();
    const branchFolder = folders.find(f => (f.name || '').toUpperCase() === targetBranchUpper);
    if (branchFolder && map[branchFolder.id]) {
      startingNodes = [map[branchFolder.id]];
    }
  } else {
    // If no specific branch, unwrap Bikramshila root to show RAHEE and IRCON directly at top level
    roots.forEach(r => {
      if (r.name && (r.name.toUpperCase() === 'BIKRAMSHILA' || r.name.toUpperCase() === 'BKS') && r.children.length > 0) {
        startingNodes.push(...r.children);
      } else {
        startingNodes.push(r);
      }
    });
  }

  const result = [];
  function traverse(nodes, depth = 0) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      const indentPrefix = depth > 0 ? '\u00A0\u00A0'.repeat(depth * 2) + '↳ 📂 ' : '📁 ';
      result.push({
        ...node,
        displayName: `${indentPrefix}${node.name}`,
        depth
      });
      if (node.children && node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(startingNodes);
  return result;
}

// Helper to return hierarchical nested tree structure (with children arrays) for TreeView components
export function getFolderTreeNodes(folders, branchName = null) {
  if (!folders || !Array.isArray(folders)) return [];
  const map = {};
  folders.forEach(f => {
    map[f.id] = { 
      ...f, 
      children: [], 
      direct_document_count: f.document_count || 0, 
      document_count: f.document_count || 0 
    };
  });

  const roots = [];
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) {
      map[f.parent_id].children.push(map[f.id]);
    } else {
      roots.push(map[f.id]);
    }
  });

  function calculateCumulativeCounts(node) {
    let total = node.direct_document_count || 0;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        total += calculateCumulativeCounts(child);
      }
    }
    node.document_count = total;
    return total;
  }

  roots.forEach(root => calculateCumulativeCounts(root));

  let startingNodes = [];
  if (branchName) {
    const targetBranchUpper = branchName.toUpperCase();
    const branchFolder = folders.find(f => (f.name || '').toUpperCase() === targetBranchUpper);
    if (branchFolder && map[branchFolder.id]) {
      startingNodes = [map[branchFolder.id]];
    }
  } else {
    roots.forEach(r => {
      if (r.name && (r.name.toUpperCase() === 'BIKRAMSHILA' || r.name.toUpperCase() === 'BKS') && r.children.length > 0) {
        startingNodes.push(...r.children);
      } else {
        startingNodes.push(r);
      }
    });
  }

  function setDepthsAndSort(nodes, depth = 0, parentPath = '') {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      node.depth = depth;
      node.path = parentPath ? `${parentPath} / ${node.name}` : node.name;
      if (node.children && node.children.length > 0) {
        setDepthsAndSort(node.children, depth + 1, node.path);
      }
    }
  }

  setDepthsAndSort(startingNodes, 0, '');
  return startingNodes;
}

