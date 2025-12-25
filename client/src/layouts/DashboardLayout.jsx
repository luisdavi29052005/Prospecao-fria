import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { wahaService } from '../services/waha';
import { Play, Square, LogOut, RefreshCw, Plus } from 'lucide-react';

const getPageTitle = (pathname) => {
    if (pathname.includes('/chats')) return 'Conversas';
    if (pathname.includes('/settings')) return 'Configurações';
    if (pathname.includes('/campaigns')) return 'Campanhas';
    return 'Visão Geral';
};

const DashboardLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // const title = getPageTitle(location.pathname); // Removed global title

    const [sessions, setSessions] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [showSessionDropdown, setShowSessionDropdown] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const sessionsData = await wahaService.getSessions();
                setSessions(sessionsData || []);
                if (sessionsData && sessionsData.length > 0) {
                    // Try to restore last selected session
                    const lastSessionName = localStorage.getItem('lastSessionName');
                    const lastSession = sessionsData.find(s => s.name === lastSessionName);
                    setActiveSession(lastSession || sessionsData[0]);
                }
            } catch (error) {
                console.error('Error fetching sessions:', error.message);
            }
        };
        fetchSessions();
    }, []);

    const handleSelectSession = (session) => {
        setActiveSession(session);
        setShowSessionDropdown(false);
        // Remember selected session
        localStorage.setItem('lastSessionName', session.name);
    };

    const refreshSessions = async () => {
        try {
            const sessionsData = await wahaService.getSessions();
            setSessions(sessionsData || []);
            if (activeSession && sessionsData && sessionsData.length > 0) {
                const updated = sessionsData.find(s => s.name === activeSession.name);
                if (updated) setActiveSession(updated);
            }
        } catch (error) {
            console.error('Error refreshing sessions:', error.message);
        }
    };

    const handleSessionAction = async (action) => {
        if (!activeSession) return;
        setIsLoading(true);
        setShowActionsMenu(false);
        try {
            switch (action) {
                case 'start':
                    await wahaService.startSession(activeSession.name);
                    break;
                case 'stop':
                    await wahaService.stopSession(activeSession.name);
                    break;
                case 'logout':
                    await wahaService.logoutSession(activeSession.name);
                    break;
                case 'restart':
                    await wahaService.restartSession(activeSession.name);
                    break;
            }
            await refreshSessions();
        } catch (error) {
            console.error(`Failed to ${action} session:`, error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', width: '100%', position: 'relative', background: 'var(--bg-primary)' }}>
            <Sidebar />
            <div style={{
                marginLeft: '60px', // Adjusted to 60px
                width: 'calc(100% - 60px)',
                height: '100vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Outlet context={{ sessions, activeSession, setActiveSession, isLoading, handleSelectSession, handleSessionAction, showSessionDropdown, setShowSessionDropdown }} />
            </div>
        </div>
    );
};

export default DashboardLayout;
