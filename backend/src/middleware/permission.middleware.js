function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // STRICT UPLOAD RESTRICTION: Only Rahul Dey, Om Jha, and Somnath Mondal can upload
    if (requiredPermissions.includes('upload')) {
      const email = (req.user.email || '').toLowerCase().trim();
      const name = (req.user.name || '').toLowerCase().trim();
      const isAuthorizedUploader = 
        email === 'rahul.d@rahee.com' ||
        email.startsWith('om.jha@') ||
        email === 's.mondal@rahee.com' ||
        name.includes('rahul dey') ||
        name.includes('om jha') ||
        name.includes('somnath mondal') ||
        [5, 9, 10].includes(req.user.id);

      if (!isAuthorizedUploader) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Document upload authority is strictly restricted to Rahul Dey, Om Jha, and Somnath Mondal.'
        });
      }
      return next();
    }

    // Super Admin: Governance & Oversight ONLY (Upload is strictly disabled)
    if (req.user.is_super_admin) {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasPerm = requiredPermissions.some(perm => userPerms.includes(perm));

    if (hasPerm) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access Denied: Missing required permission (${requiredPermissions.join(' or ')}).`
    });
  };
}

module.exports = { requirePermission };
