# PAYIVVA HRCRM — Database Mapping & Architecture Document

> This document describes how the Payivva HRCRM integrates with the **existing MySQL database**
> (`u869403905_site_data`) that is already used by the Payivva Surveillance ERP software.

---

## 1. Existing Database Inspection (performed 18 Aug 2026)

### Existing tables (live, used by other software — MUST NOT be damaged)

| Table | Rows | Purpose |
|---|---|---|
| `employees` | 3 | Employee master — `employee_id`, `name`, `email`, `mobile`, `department`, `designation`, `emp_status`, `salary`, `wage_per_hour`, `joining_date`, `profile_completed`, `company`, photo/aadhaar/pan columns |
| `attendance` | 6 | GPS check-in/check-out records — `employeeId → employees.id`, `checkin_time`, `checkout_time`, `latitude`, `longitude`, `distance`, `status` (`Present`/`Denied`) |
| `employee_inventory` | 22 | Issued company assets per employee (component, quantity, issued_date, notes, createdBy) |
| `users` | 11 | Login accounts of the other software (bcrypt `$2a$`), `roleId → roles` |
| `roles` | 3 | `Super Admin`, `Site Manager`, `Worker` |
| `sites`, `site_installations`, `site_stock`, `site_drawings`, `quotations`, `quotation_items`, `stock_components`, `component_specializations`, `cctv`, `cad_files`, `tasks`, `project_progress`, `face_registrations`, `notifications` | — | Site/project modules of the other software (not reused by HRCRM) |

### Existing `hrms_*` tables (from a previous HRMS attempt — reused where compatible)

| Table | Reuse decision |
|---|---|
| `hrms_company_settings` | ✅ **Reused** — company name/address/contacts used in letters & salary slips |
| `hrms_smtp_settings` | ✅ **Reused** — SMTP configuration for the email service |
| `hrms_departments`, `hrms_designations` | ✅ **Reused** as reference data |
| `hrms_shifts` | ✅ **Reused** as shift reference (General Shift 09:30–18:30, grace 15 min) |
| `hrms_audit_logs` | ✅ **Reused** for audit logging (userId, action, module, entityId, description, ip, meta, createdAt) |
| `hrms_employees`, `hrms_users`, `hrms_attendances`, `hrms_leaves`, `hrms_leave_balances`, `hrms_documents`, `hrms_letters`, `hrms_notifications`, `hrms_payrolls`, `hrms_salary_slips`, `hrms_refresh_tokens`, `hrms_password_reset_tokens` | ⚠️ **NOT reused** — schema conflicts with requirements (single-level leave approval, wrong role enum, duplicate employee master). Left untouched. |

---

## 2. Reuse Strategy

| HRCRM need | Reused table | Access |
|---|---|---|
| Employee master (IDs, name, email, department, designation, salary, joining date) | `employees` | read + write (HRCRM completes the profile here so the other software sees it) |
| Attendance data (used by salary calculation) | `attendance` | **read-only** — never written by HRCRM |
| Company assets issued to workers | `employee_inventory` | read + insert (HRCRM adds records, never deletes) |
| Company info for letters/slips | `hrms_company_settings` | read + update (System Settings) |
| SMTP credentials | `hrms_smtp_settings` | read + update (Email Settings) |
| Departments / designations | `hrms_departments`, `hrms_designations` | read-only |
| Shift policy | `hrms_shifts` | read-only |
| Audit trail | `hrms_audit_logs` | insert + read |

**Attendance integration:** the existing `attendance` table stores GPS check-in/check-out rows
(status `Present`/`Denied`, timestamps in UTC). The `attendanceService` (backend) abstracts this table:

- `getDailyRecords(employeeId, dateRange)` → per-day check-in/check-out + status
- `getMonthlySummary(employeeId, month)` → present days, absent days, half days, late marks,
  overtime minutes, total hours, leave days (from approved leaves)
- Days are bucketed using the configured timezone offset (`hrcrm_settings.attendanceTimezone`, default `+05:30`).

No duplicate attendance table is created. Salary calculations consume `attendanceService` output.

---

## 3. New HRCRM-only Tables (`hrcrm_*` prefix)

Created idempotently by `backend/db/schema.sql` (run via `npm run db:setup`). All are
HRCRM-specific — no existing table is altered.

| Table | Purpose |
|---|---|
| `hrcrm_users` | HRCRM login accounts. Role enum `worker`/`it`/`director`. Links to `employees.id`. Onboarding token for profile-completion link. |
| `hrcrm_password_reset_tokens` | Forgot-password flow |
| `hrcrm_profile_details` | Section 1 — Personal information |
| `hrcrm_contact_details` | Section 2 — Contact & family details |
| `hrcrm_education` | Section 3 — Education history (dynamic rows) |
| `hrcrm_employment_details` | Section 4 — Previous employment + bank details |
| `hrcrm_skills` | Section 5 — IT / Non-IT skills (multi-select + custom) |
| `hrcrm_documents` | Section 6 — Document vault (base64 PDF storage + per-doc verification + versioning) |
| `hrcrm_verification` | Two-level employee verification (IT + Director statuses, reviewers, timestamps, remarks) |
| `hrcrm_verification_history` | History of verification events |
| `hrcrm_leaves` | Leave requests with two-level approval workflow |
| `hrcrm_leave_balances` | Annual leave balance per type (casual / privilege / half_day / wfh) |
| `hrcrm_letters` | Generated letters (offer/joining/appointment/increment/promotion) with versions |
| `hrcrm_salary_config` | Configurable salary rules (workdays, components, deduction policy) |
| `hrcrm_payrolls` | Monthly payroll records (attendance-derived) |
| `hrcrm_salary_slips` | Generated salary-slip PDFs |
| `hrcrm_email_logs` | Email send logs (recipient, subject, status, error) |
| `hrcrm_notifications` | In-app notifications |
| `hrcrm_settings` | HRCRM settings (timezone, monthly workdays, leave policy, default credentials behaviour) |

**Data protection:** bank details, Aadhaar, PAN, salary & document contents are stored in the
database only; they are never exposed to the frontend except through authenticated,
role-authorized API endpoints.

---

## 4. Authentication & Roles

- HRCRM has its **own** `hrcrm_users` table — it never writes to the other software's `users` table.
- Passwords: bcrypt (`bcryptjs`). JWT access token (12h) + refresh token (7d).
- Roles: `worker`, `it`, `director`. Access rules enforced by middleware on every route.
- Optional credential import: when IT creates a worker, if a matching account exists in the other
  software's `users` table, the existing bcrypt hash may be imported so the worker logs into HRCRM
  with the same password (read-only copy; the `users` table is never modified).

---

## 5. Vercel Architecture

```
HRCRM/
├── api/index.js        ← Express app exported as one Vercel serverless function
├── backend/            ← Express app (app.js), services, repositories, controllers, routes
├── frontend/           ← React (Vite) SPA
├── shared/             ← shared constants
├── vercel.json         ← static build + /api routing + SPA fallback
```

- Frontend is built by Vite into `frontend/dist`, copied to root `dist` (outputDirectory).
- `api/index.js` is detected as a Vercel serverless function (Node runtime) and serves all `/api/*` routes.
- Database access uses a **shared connection pool** (`mysql2/promise`) that survives cold starts;
  the serverless entry keeps the pool module-level so functions reuse connections.
- All credentials come from environment variables set in the Vercel dashboard.
  `npm run db:setup` (run once locally or via a one-off Vercel CLI command) creates the
  `hrcrm_*` tables idempotently.

---

## 6. Onboarding / Verification workflow (implemented end-to-end)

```
IT creates worker registration → hrcrm_users account + onboarding link
→ worker opens link → sets password → completes 7 profile sections
→ uploads documents → agrees & submits
→ PENDING IT VERIFICATION → IT approves/rejects (with reason)
→ PENDING DIRECTOR VERIFICATION → Director approves/rejects (with reason)
→ FULLY VERIFIED EMPLOYEE → visible in Employee Management, attendance + leave + salary linked
```

Leave workflow: worker request → Pending IT → IT approved → Pending Director → Director approved
→ FINAL APPROVED. Rejections store reasons and notify the worker.

Salary workflow: attendanceService (existing `attendance`) → configurable salaryService
(`hrcrm_salary_config`) → draft payroll → Director review → finalize → salary slip PDF
(`hrcrm_salary_slips`) → preview/download/email.

---

## 7. Security measures

- JWT auth + role middleware; bcrypt password hashing; parameterized SQL everywhere.
- Input validation (Joi) on every write endpoint; centralized error handler (no stack leaks).
- Helmet security headers; CORS whitelist; rate limiting on auth endpoints.
- File uploads: PDF-only policy (configurable), size limit 2 MB, MIME validated, stored as base64
  in `hrcrm_documents` (survives serverless statelessness, no external storage required).
- Secrets (`DATABASE_PASSWORD`, `JWT_SECRET`, SMTP password) exist only as environment variables.
- Audit logs for every sensitive action (login, approvals, salary, letters, emails, role changes).