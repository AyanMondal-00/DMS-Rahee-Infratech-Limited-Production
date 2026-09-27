# 📁 Enterprise Document Management System (EDMS) - Master Specification

> **Official Multi-Company Specification & User Governance Directory**  
> Tailored for **Rahee Infratech Limited** (Company 1), **Ircon International Limited** (Company 2), and **Central Bikramshila Infrastructure Governance**.

---

## 📐 1. System Governance & Access Flowchart

```mermaid
flowchart TD
    classDef superStyle fill:#1e293b,stroke:#0f172a,stroke-width:2px,color:#ffffff
    classDef raheeStyle fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#ffffff
    classDef irconStyle fill:#059669,stroke:#047857,stroke-width:2px,color:#ffffff
    classDef viewStyle fill:#475569,stroke:#334155,stroke-width:2px,color:#ffffff

    SuperAdmin["🔑 Rajib Ghosh (Super-Admin)<br/>• Email: rajib.g@rahee.com &bull; Official Password: R@jib#Ghosh2026<br/>• Sole User Creation & Governance Authority for Both Companies<br/>• Governs Central Bikramshila Root Directory & Branches<br/>• Exclusive System Deletion & Restoration Authority (No Upload)"]:::superStyle

    SuperAdmin --> RaheeAdmin["🏢 Rahul Dey (Rahee Company Admin)<br/>• Email: rahul.d@rahee.com &bull; Official Password: R@hul#Dey2026<br/>• Create Folders & Upload Documents under Bikramshila/RAHEE<br/>• Document Upload: YES | Notification: YES"]:::raheeStyle

    SuperAdmin --> IrconAdmin["🏢 Om Jha (Ircon Company Admin)<br/>• Email: om.jha@ircon.org &bull; Official Password: Om#Jha2026<br/>• Create Folders & Upload Documents under Bikramshila/IRCON<br/>• Document Upload: YES | Notification: YES"]:::irconStyle

    RaheeAdmin --> RaheeExec["⚙️ Somnath Mondal (Execution Control)<br/>• Email: s.mondal@rahee.com &bull; Official Password: S@menath#Mondal2026<br/>• Document Upload: YES | Notification: YES"]:::raheeStyle

    RaheeAdmin --> RaheeViewers["👁️ Rahee Managers & Viewers<br/>• Kiran Sankar, Mukesh Prasad, Pintu Bhukta (Notification: YES)<br/>• Ayush Khaitan, Manoj Ghosh, Arunabha Pyne, Manish Patra (Notification: NO)<br/>• Universal View, Preview & Download across Bikramshila"]:::viewStyle

    IrconAdmin --> IrconExec["⚙️ Shardu Kumar Rastogi (Execution Control)<br/>• Email: shardu.rastogi@ircon.org &bull; Official Password: Sh@rdu#Rastogi2026<br/>• Document Capability: Viewer | Notification: YES"]:::irconStyle

    IrconAdmin --> IrconReview["🔍 Chandra Bijay Singh (Review)<br/>• Email: chandra.singh@ircon.org &bull; Official Password: Ch@ndra#Singh2026<br/>• Document Capability: Viewer | Notification: YES"]:::irconStyle
```

---

## 🔑 2. Global Super-Admin Authority & Specifications

| Parameter | Master Technical Specification |
| :--- | :--- |
| **Super Admin Name** | **Rajib Ghosh** |
| **Registered Email** | `rajib.g@rahee.com` |
| **Official Password** | `R@jib#Ghosh2026` |
| **Role & Scope** | **Global Super-Admin** (System-Wide: Rahee Infratech + Ircon International) |
| **User Creation Authority** | **SOLE AUTHORITY:** Super-Admin Rajib Ghosh creates, edits, and manages user accounts for both companies. |
| **Folder Governance** | **Central Bikramshila Root:** Full authority over the **`Bikramshila`** root folder and both company branches (`RAHEE` & `IRCON`). |
| **Document Capability** | **VIEWER / GOVERNANCE:** Rajib Ghosh focuses on User Management, Audit Logs, and Archival/Restoration Governance (No Document Upload). |
| **Deletion Authority** | **EXCLUSIVE AUTHORITY:** File and folder deletion is strictly locked to Super Admin (`Rajib Ghosh` / `Global Admin`). |
| **Document Restoration** | **EXCLUSIVE AUTHORITY:** Super Admin can restore archived files back into the active folder tree (`POST /api/documents/:id/restore`). |

---

## 🏢 3. Rahee Infratech Limited — Official User Specifications

| Name | Email ID | Official Password | Designation | Notification on Upload | Document Capability | Preview & Download | Supported Formats |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Rahul Dey** | `rahul.d@rahee.com` | `R@hul#Dey2026` | **Admin** | **Yes** | 📤 **Upload** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Somnath Mondal** | `s.mondal@rahee.com` | `S@menath#Mondal2026` | **Execution Control** | **Yes** | 📤 **Upload** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Kiran Sankar Chowdhury** | `kiransankar.c@rahee.com` | `K1ran#Sankar2026` | **Manager** | **Yes** | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Mukesh Kumar Prasad** | `mukesh.p@rahee.com` | `M@kesh#Prasad2026` | **Manager** | **Yes** | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Pintu Bhukta** | `pintu.b@rahee.com` | `P1ntu#Bhukta2026` | **Manager** | **Yes** | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Ayush Khaitan** | `ayush.k@rahee.com` | `Ayu$h#Khaitan2026` | **Manager** | No | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Manoj Ghosh** | `manoj.g@rahee.com` | `M@noj#Ghosh2026` | **Manager** | No | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Arunabha Pyne** | `arunabha.p@rahee.com` | `Arun#Pyne2026` | **Manager** | No | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Manish Kumar Patra** | `manish.p@rahee.com` | `M@nish#Patra2026` | **Viewer** | No | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |

---

## 🏛️ 4. Ircon International Limited — Official User Specifications

| Name | Email ID | Official Password | Designation | Notification on Upload | Document Capability | Preview & Download | Supported Formats |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Om Jha** | `om.jha@ircon.org` | `Om#Jha2026` | **Admin** | **Yes** | 📤 **Upload** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Shardu Kumar Rastogi** | `shardu.rastogi@ircon.org` | `Sh@rdu#Rastogi2026` | **Execution Control** | **Yes** | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
| **Chandra Bijay Singh** | `chandra.singh@ircon.org` | `Ch@ndra#Singh2026` | **Review** | **Yes** | 👁️ **Viewer** | ✅ Preview & Download | Word, PDF, Excel, PPTX, Images, CAD/3D |
---

## ⚙️ 5. Master Governance Policies & Technical Rules

### A. Universal Cross-Company Access for Both Companies
* Both **Rahee Infratech Limited** and **Ircon International Limited** operate within a single central environment.
* All authenticated users from both companies can search, view, preview, and download documents across both `RAHEE` and `IRCON` branches.

### B. Upload Scopes
* **Rahee Branch (`RAHEE`)**: Uploads permitted exclusively to **Rahul Dey** and **Somnath Mondal**.
* **Ircon Branch (`IRCON`)**: Uploads permitted exclusively to **Om Jha**.
* **Super Admin**: Dedicated to User Governance, Policy Management, and System Audit.

### C. Folder Structure
* **Super Admin View**: Central Root **`Bikramshila`** with company branches **`RAHEE`** and **`IRCON`**.
* **Company Users View**: Direct root starts at **`RAHEE`** (for Rahee users) and **`IRCON`** (for Ircon users).

### D. Single-Tier Static Tagging (`General Version V1`)
* Every uploaded file is tagged with **`General Version V1`** for instant repository availability.

### E. Exclusive Super-Admin Deletion Safeguard
* Regular users and Company Admins are strictly blocked from deleting files (`HTTP 403 Forbidden`). Deletion is exclusive to Super Admin.
