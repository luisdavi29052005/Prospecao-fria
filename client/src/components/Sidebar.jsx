import React, { useState } from 'react';
import { MessageSquare, Settings, LogOut, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const SidebarItem = ({ icon: Icon, active, onClick }) => {
    return (
        <div
            onClick={onClick}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // marginBottom removed to rely on parent gap for strict control
                cursor: 'pointer',
                background: 'transparent'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: active ? 1 : 0.6,
                    transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)', // Ultra-smooth fade
                }}
                onMouseEnter={(e) => {
                    if (!active) {
                        e.currentTarget.style.opacity = 1;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!active) {
                        e.currentTarget.style.opacity = 0.6;
                    }
                }}
            >
                <Icon
                    size={22}
                    strokeWidth={1.5}
                    color={active ? "url(#icon-gradient)" : "#94A3B8"}
                    style={{
                        transition: 'stroke 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
            </div>
        </div>
    );
};

const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: danger ? 'var(--danger)' : 'var(--text-primary)',
            transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
        <Icon size={16} />
        {label}
    </div>
);

const Sidebar = () => {
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname.startsWith(path);

    return (
        <div style={{
            width: '60px', // Ultra-Compact
            height: '100vh',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 0',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 50,
            borderRight: '1px solid #E2E8F0', // Visual Divider
            boxShadow: 'none'
        }}>
            {/* Global SVG Definition for Gradient Strokes */}
            <svg width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
                <defs>
                    <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgb(96, 165, 250)" /> {/* Blue 400 */}
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" /> {/* Blue 500 */}
                    </linearGradient>
                </defs>
            </svg>

            {/* Nav Items */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <SidebarItem
                    icon={MessageSquare}
                    active={isActive('/app/chats')}
                    onClick={() => navigate('/app/chats')}
                />
                <SidebarItem
                    icon={Megaphone}
                    active={isActive('/app/campaigns')}
                    onClick={() => navigate('/app/campaigns')}
                />
                <SidebarItem
                    icon={Settings}
                    active={isActive('/app/settings')}
                    onClick={() => navigate('/app/settings')}
                />
            </div>

            {/* Profile Menu Trigger */}
            <div style={{ position: 'relative' }}>
                {showMenu && (
                    <div style={{
                        position: 'absolute',
                        left: '60px',
                        bottom: '10px',
                        width: '240px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--sidebar-border)',
                        borderRadius: '16px',
                        padding: '8px',
                        boxShadow: 'var(--shadow-float)',
                        zIndex: 100
                    }}>
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--bg-tertiary)', marginBottom: '4px' }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.user_metadata?.full_name || 'Usuário'}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.email}
                            </p>
                        </div>
                        <MenuItem icon={Settings} label="Configurações" onClick={() => setShowMenu(false)} />
                        <MenuItem icon={LogOut} label="Sair da conta" onClick={logout} danger />
                    </div>
                )}

                <div
                    onClick={() => setShowMenu(!showMenu)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'var(--bg-tertiary)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        border: showMenu ? '2px solid var(--primary)' : '2px solid transparent', // Keep outline for profile context
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        color: 'var(--text-primary)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {user?.user_metadata?.avatar_url ? (
                        <img
                            src={user.user_metadata.avatar_url}
                            alt="Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>
                            {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
