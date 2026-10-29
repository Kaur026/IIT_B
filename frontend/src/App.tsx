import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, StaffRoute, RoleRoute } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { PortalLayout } from './components/portal/PortalLayout';
import { DashboardPage } from './pages/DashboardPage';
import { BeneficiaryListPage } from './pages/BeneficiaryListPage';
import { RegisterBeneficiaryPage } from './pages/RegisterBeneficiaryPage';
import { MeasurementPage } from './pages/MeasurementPage';
import { ActionQueuePage } from './pages/ActionQueuePage';
import { ChildProfilePage } from './pages/ChildProfilePage';
import { ReferralsPage } from './pages/ReferralsPage';
import { RuleSettingsPage } from './pages/RuleSettingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffProfilePage } from './pages/StaffProfilePage';
import { SyntheticWorkflowPage } from './pages/SyntheticWorkflowPage';
import { SyntheticOperationsPage } from './pages/SyntheticOperationsPage';
import { B1ChildExplorerPage } from './pages/B1ChildExplorerPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing & Sign In (Role Simulation) */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/b1-explorer" element={<B1ChildExplorerPage />} />
            <Route path="/synthetic-workflow" element={import.meta.env.DEV ? <SyntheticWorkflowPage /> : <Navigate to="/" replace />} />
            <Route path="/synthetic-operations" element={import.meta.env.DEV ? <SyntheticOperationsPage /> : <Navigate to="/" replace />} />

            {/* Dashboard: Public aggregate-only overview or authenticated role briefing */}
            <Route
              path="/dashboard"
              element={
                <PortalLayout>
                  <DashboardPage />
                </PortalLayout>
              }
            />

            {/* 1. Beneficiary Directory (Protected: requires sign-in, scoped to role) */}
            <Route
              path="/beneficiaries"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <BeneficiaryListPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />
            <Route
              path="/beneficiaries/register"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <RegisterBeneficiaryPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 2. Longitudinal Child Profile (Protected: requires sign-in) */}
            <Route
              path="/beneficiaries/:id"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <ChildProfilePage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 3. Dedicated Screening & Measurement Intake (AWW & LS only) */}
            <Route
              path="/measurements"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <MeasurementPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 4. Frontline Action Queue (Protected: scoped to role) */}
            <Route
              path="/queue"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <ActionQueuePage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 5. Clinical Referrals & Follow-up Tracking (Protected: scoped to role) */}
            <Route
              path="/referrals"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <ReferralsPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 6. Supervisory Rule Settings (Protected: LS, CDPO, DPO only; AWW forbidden) */}
            <Route
              path="/rules"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <RuleSettingsPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 7. Sector Reports & Audit Exports (Protected: LS, CDPO, DPO only; sign-in required) */}
            <Route
              path="/reports"
              element={
                <RoleRoute>
                  <PortalLayout>
                    <ReportsPage />
                  </PortalLayout>
                </RoleRoute>
              }
            />

            {/* 8. Frontline Staff Profile (Staff Protected Route) */}
            <Route
              path="/profile"
              element={
                <StaffRoute>
                  <PortalLayout>
                    <StaffProfilePage />
                  </PortalLayout>
                </StaffRoute>
              }
            />

            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
