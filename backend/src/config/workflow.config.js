/**
 * Centralized Enterprise Document Management System (DMS)
 * Master Feature Configuration File
 */

module.exports = {
  // 1. Multi-Tenant Data Isolation
  // Set false: Enables universal cross-visibility for Rahee & Ircon users across BKS folder structure.
  MULTI_TENANT_ISOLATION_ENABLED: false,

  // 2. 7-Day Unapproved Document Archival Policy
  ARCHIVAL_POLICY_ENABLED: false,

  // 3. Operational Folder Exemption Tag
  OPERATIONAL_FOLDER_ENABLED: false,

  // 4. Strict No-Deletion Permission Rule
  // Set true: Strictly restricts file and folder deletion permission to Super Admin ONLY.
  ONLY_SUPER_ADMIN_CAN_DELETE: true,

  // 5. BKS Directory Hierarchy Mode
  BKS_FOLDER_MODE: true,

  // 6. Admin Folder Creation Permission (Configurable)
  ADMIN_FOLDER_CREATION_ENABLED: true
};
