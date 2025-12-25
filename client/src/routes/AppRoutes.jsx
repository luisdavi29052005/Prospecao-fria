import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

import ChatsPage from '../pages/app/ChatsPage';
import CampaignsPage from '../pages/app/CampaignsPage';
import SettingsPage from '../pages/app/SettingsPage';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Auth Routes */}
            <Route path="/auth" element={<AuthLayout />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route index element={<Navigate to="login" replace />} />
            </Route>

            {/* Protected App Routes */}
            <Route path="/app" element={<ProtectedRoute />}>
                {/* Wrap all protected pages in Dashboard Layout */}
                <Route element={<DashboardLayout />}>
                    <Route path="chats" element={<ChatsPage />} />
                    <Route path="campaigns" element={<CampaignsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route index element={<Navigate to="chats" replace />} />
                </Route>
            </Route>

            {/* Root Redirect */}
            {/* Root Redirect: Check auth state */}
            <Route path="/" element={<RootRedirect />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
    );
};

const RootRedirect = () => {
    const { user } = useAuth();
    if (user) {
        return <Navigate to="/app/chats" replace />;
    }
    return <Navigate to="/auth/login" replace />;
};

export default AppRoutes;
