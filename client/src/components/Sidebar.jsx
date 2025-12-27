import React, { useState } from 'react';
import { MessageSquare, Settings, LogOut, Megaphone, Bot, Box } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const SidebarItem = ({ icon: Icon, active, onClick, label, danger }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="group"
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
            }}
        >
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    width: '48px', // w-12
                    height: '48px', // h-12
                    borderRadius: '16px', // rounded-2xl
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 300ms ease-in-out', // duration-300 ease-in-out

                    // States
                    background: active
                        ? 'rgba(238, 242, 255, 0.5)' // bg-indigo-50/50
                        : (isHovered && !danger ? 'var(--slate-50)' : 'transparent'),

                    color: danger
                        ? '#ef4444'
                        : (active ? 'var(--indigo-600)' : (isHovered ? 'var(--slate-600)' : 'var(--slate-400)')),

                    // Premium Glow Shadow for active state
                    boxShadow: active
                        ? '0 0 15px rgba(99, 102, 241, 0.3)' // shadow-[0_0_15px_rgba(99,102,241,0.3)]
                        : 'none',

                    // Remove default outline
                    outline: 'none'
                }}
            >
                <Icon
                    size={24}
                    strokeWidth={1.5} // Elegant thin stroke
                />
            </button>

            {/* Tooltip (Right side, z-50, dark bg, white text) */}
            <div
                className="group-hover-tooltip"
                style={{
                    position: 'absolute',
                    left: '100%',
                    marginLeft: '16px',
                    background: 'var(--slate-900)',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    zIndex: 50,
                    pointerEvents: 'none',
                    boxShadow: 'var(--shadow-md)',
                    opacity: 0,
                    animation: 'fadeIn 0.2s forwards' // You might need to add @keyframes fadeIn in index.css for this if not present, but for now simple display block from CSS works. 
                    // To keep it simple with existing CSS hover logic:
                }}
            >
                {label}
                {/* Tooltip Arrow */}
                <div style={{
                    position: 'absolute',
                    left: '-4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderRight: '4px solid var(--slate-900)'
                }} />
            </div>
        </div>
    );
};

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isAvatarHovered, setIsAvatarHovered] = useState(false);

    const getActive = () => {
        const path = location.pathname;
        if (path.startsWith('/app/chats')) return 'chats';
        if (path.startsWith('/app/campaigns')) return 'campaigns';
        if (path.startsWith('/app/agents')) return 'agents';
        if (path.startsWith('/app/settings')) return 'settings';
        return '';
    };

    const activeTab = getActive();

    return (
        <div style={{
            width: '80px', // w-20
            height: '100vh',
            minHeight: '100vh',
            background: 'rgba(255, 255, 255, 0.8)', // bg-white/80
            backdropFilter: 'blur(12px)', // backdrop-blur-md
            webkitBackdropFilter: 'blur(12px)',
            borderRight: '1px solid var(--slate-200)', // delicate border
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 0',
            zIndex: 50,
            flexShrink: 0 // Prevent shrinking in flex container
        }}>

            {/* Top: Logo (No solid background) */}
            <div style={{
                marginBottom: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--indigo-600)' // Colored icon directly
            }}>
                <Box size={28} strokeWidth={2} />
            </div>

            {/* Center: Navigation Menu */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <SidebarItem
                    icon={MessageSquare}
                    label="Conversas"
                    active={activeTab === 'chats'}
                    onClick={() => navigate('/app/chats')}
                />
                <SidebarItem
                    icon={Megaphone}
                    label="Campanhas"
                    active={activeTab === 'campaigns'}
                    onClick={() => navigate('/app/campaigns')}
                />
                <SidebarItem
                    icon={Bot}
                    label="Agentes IA"
                    active={activeTab === 'agents'}
                    onClick={() => navigate('/app/agents')}
                />
            </div>

            {/* Bottom: Settings & Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <SidebarItem
                    icon={Settings}
                    label="Configurações"
                    active={activeTab === 'settings'}
                    onClick={() => navigate('/app/settings')}
                />

                <div style={{ height: '1px', width: '32px', background: 'var(--slate-100)', margin: '8px 0' }} />

                <div
                    className="group"
                    onClick={logout}
                    title="Sair da conta"
                    onMouseEnter={() => setIsAvatarHovered(true)}
                    onMouseLeave={() => setIsAvatarHovered(false)}
                    style={{
                        position: 'relative',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <div style={{
                        width: '40px', // w-10
                        height: '40px', // h-10
                        borderRadius: '50%', // rounded-full
                        overflow: 'hidden',
                        // Ring effect: ring-2 ring-white ring-offset-2 ring-offset-slate-100
                        boxShadow: `0 0 0 2px white, 0 0 0 4px ${isAvatarHovered ? 'var(--indigo-50)' : 'var(--slate-100)'}`,
                        transition: 'all 300ms ease-in-out',
                        opacity: isAvatarHovered ? 0.9 : 1
                    }}>
                        {user?.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Profile"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: 'var(--slate-200)', // Subtle grey instead of dark
                                color: 'var(--slate-600)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: 600
                            }}>
                                {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    {/* Tooltip for Logout */}
                    <div
                        className="group-hover-tooltip"
                        style={{
                            position: 'absolute',
                            left: '100%',
                            marginLeft: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--slate-900)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 500,
                            padding: '6px 10px',
                            borderRadius: '8px',
                            whiteSpace: 'nowrap',
                            zIndex: 50,
                            pointerEvents: 'none',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        Sair ({user?.email})
                        <div style={{
                            position: 'absolute',
                            left: '-4px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                            borderRight: '4px solid var(--slate-900)'
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
