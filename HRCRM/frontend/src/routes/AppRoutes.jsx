import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LoadingPage } from '../components/ui/Feedback.jsx'
import DashboardLayout from '../layouts/DashboardLayout.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import OnboardingPage from '../pages/OnboardingPage.jsx'
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx'
import WorkerDashboard from '../pages/worker/WorkerDashboard.jsx'
import WorkerProfile from '../pages/worker/WorkerProfile.jsx'
import WorkerDocuments from '../pages/worker/WorkerDocuments.jsx'
import WorkerLeaves from '../pages/worker/WorkerLeaves.jsx'
import WorkerAttendance from '../pages/worker/WorkerAttendance.jsx'
import WorkerSalary from '../pages/worker/WorkerSalary.jsx'
import WorkerLetters from '../pages/worker/WorkerLetters.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import ItDashboard from '../pages/it/ItDashboard.jsx'
import ItWorkers from '../pages/it/ItWorkers.jsx'
import ItWorkerDetail from '../pages/it/ItWorkerDetail.jsx'
import ItVerification from '../pages/it/ItVerification.jsx'
import ItLeaves from '../pages/it/ItLeaves.jsx'
import ItEmergencyUnblock from '../pages/it/ItEmergencyUnblock.jsx'
import ItLetters from '../pages/it/ItLetters.jsx'
import ItEmails from '../pages/it/ItEmails.jsx'
import ItAccess from '../pages/it/ItAccess.jsx'
import AuditLogsPage from '../pages/AuditLogsPage.jsx'
import AdminDashboard from '../pages/admin/AdminDashboard.jsx'
import AdminVerification from '../pages/admin/AdminVerification.jsx'
import AdminEmployees from '../pages/admin/AdminEmployees.jsx'
import AdminEmployeeDetail from '../pages/admin/AdminEmployeeDetail.jsx'
import AdminLeaves from '../pages/admin/AdminLeaves.jsx'
import AdminAttendance from '../pages/admin/AdminAttendance.jsx'
import AdminSalary from '../pages/admin/AdminSalary.jsx'
import AdminLetters from '../pages/admin/AdminLetters.jsx'
import AdminEmails from '../pages/admin/AdminEmails.jsx'
import AdminSettings from '../pages/admin/AdminSettings.jsx'

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'worker' ? '/worker/dashboard' : user.role === 'it' ? '/it/dashboard' : '/admin/dashboard'} replace />
  return children
}

function RoleLayout({ roles }) {
  return (
    <RequireRole roles={roles}>
      <DashboardLayout />
    </RequireRole>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/worker" element={<RoleLayout roles={['worker']} />}>
        <Route path="dashboard" element={<WorkerDashboard />} />
        <Route path="profile" element={<WorkerProfile />} />
        <Route path="documents" element={<WorkerDocuments />} />
        <Route path="leaves" element={<WorkerLeaves />} />
        <Route path="attendance" element={<WorkerAttendance />} />
        <Route path="salary" element={<WorkerSalary />} />
        <Route path="letters" element={<WorkerLetters />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/it" element={<RoleLayout roles={['it', 'director']} />}>
        <Route path="dashboard" element={<ItDashboard />} />
        <Route path="workers" element={<ItWorkers />} />
        <Route path="workers/:id" element={<ItWorkerDetail />} />
        <Route path="verification" element={<ItVerification />} />
        <Route path="leaves" element={<ItLeaves />} />
        <Route path="emergency-unblock" element={<ItEmergencyUnblock />} />
        <Route path="letters" element={<ItLetters />} />
        <Route path="emails" element={<ItEmails />} />
        <Route path="access" element={<ItAccess />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>

      <Route path="/admin" element={<RoleLayout roles={['director']} />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="employees/:id" element={<AdminEmployeeDetail />} />
        <Route path="leaves" element={<AdminLeaves />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="salary" element={<AdminSalary />} />
        <Route path="letters" element={<AdminLetters />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}