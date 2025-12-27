import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Play, Pause, Search, Filter, Layers, User, Hash, MessageSquare, CheckCircle, BarChart, ArrowRight, Sparkles, Command, Database } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import CampaignCreateModal from '../../components/modals/CampaignCreateModal';

const CampaignsPage = () => {
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('Todas');

    // Resizable columns
    const [columnWidths, setColumnWidths] = useState({
        name: 300,
        status: 120,
        agent: 160,
        leads: 100,
        responded: 120,
        negotiating: 120,
        won: 100,
        rate: 100,
        actions: 80
    });

    const resizingRef = useRef(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    // --- Actions ---
    const handleStatusToggle = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';

        // Optimistic Update
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));

        const { error } = await supabase
            .from('campaigns')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error updating status:', error);
            // Revert
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus } : c));
            // You might want to show a toast here
        }
    };

    useEffect(() => {
        const fetchCampaigns = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('campaigns')
                    .select('*, agents (name)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Map to UI Structure
                const formatted = data.map(c => ({
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    agent: c.agents ? c.agents.name : '—', // Linked Agent Name
                    leads: c.total_leads || 0,
                    responded: c.total_responded || 0,
                    negotiating: 0, // Placeholder until deeper logic
                    won: 0, // Placeholder
                    rate: c.total_leads > 0 ? `${Math.round((c.total_responded / c.total_leads) * 100)}%` : '0%'
                }));

                setCampaigns(formatted);
            } catch (error) {
                console.error('Error fetching campaigns:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCampaigns();
    }, []);

    const handleMouseDown = useCallback((e, colKey) => {
        e.preventDefault();
        resizingRef.current = colKey;
        startXRef.current = e.clientX;
        startWidthRef.current = columnWidths[colKey];
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths]);

    const handleMouseMove = useCallback((e) => {
        if (!resizingRef.current) return;
        const diff = e.clientX - startXRef.current;
        const newWidth = Math.max(60, startWidthRef.current + diff);
        setColumnWidths(prev => ({ ...prev, [resizingRef.current]: newWidth }));
    }, []);

    const handleMouseUp = useCallback(() => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const columns = [
        { key: 'name', label: 'Nome' },
        { key: 'status', label: 'Status' },
        { key: 'agent', label: 'Agente' },
        { key: 'leads', label: 'Leads' },
        { key: 'responded', label: 'Respostas' },
        { key: 'negotiating', label: 'Em Negoc.' },
        { key: 'won', label: 'Ganhos' },
        { key: 'rate', label: 'Conv.' },
        { key: 'actions', label: '' }
    ];

    const filteredCampaigns = campaigns.filter(campaign => {
        if (activeTab === 'Todas') return true;
        if (activeTab === 'Ativas') return campaign.status === 'active';
        if (activeTab === 'Rascunhos') return campaign.status === 'draft' || campaign.status === 'paused'; // Assuming drafts/paused are grouped
        if (activeTab === 'Concluídas') return campaign.status === 'completed';
        return true;
    });

    // DATA STATE: Structured Table Layout (Stripe Style)
    return (
        <div style={{
            height: '100%',
            width: '100%',
            background: '#F8FAFC', // Slate 50
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '"Inter", sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: '64px',
                minHeight: '64px',
                padding: '0 32px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FFFFFF',
                flexShrink: 0
            }}>
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#0F172A',
                    letterSpacing: '-0.02em',
                    margin: 0
                }}>
                    Campanhas
                </h1>

                {campaigns.length > 0 && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        style={{
                            height: '36px',
                            padding: '0 16px',
                            background: '#2563EB',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#1D4ED8'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#2563EB'}
                    >
                        <Plus size={16} />
                        Nova Campanha
                    </button>
                )}
            </header>

            {/* Main Content */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                padding: '32px'
            }}>
                {/* 1. Richer Metrics (Visual Density) */}
                <div style={{ marginBottom: '32px', display: 'flex', gap: '48px', paddingLeft: '8px' }}>
                    <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ativas</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <p style={{ fontSize: '30px', fontWeight: 700, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                                {campaigns.filter(c => c.status === 'active').length}
                            </p>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>vs. último mês</span>
                        </div>
                    </div>
                    <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total Leads</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <p style={{ fontSize: '30px', fontWeight: 700, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                                {campaigns.reduce((acc, curr) => acc + (curr.leads || 0), 0)}
                            </p>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>vs. último mês</span>
                        </div>
                    </div>
                </div>

                {/* 2. Structured Table Card */}
                <div style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative', // Context for absolute positioning
                    minHeight: '400px' // Ensure height for skeletons
                }}>
                    {/* Toolbar */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid #F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 20, // Sit on top
                        background: '#FFFFFF',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', gap: '24px' }}>
                            {/* Tabs ... */}
                            {['Todas', 'Rascunhos'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: activeTab === tab ? '#0F172A' : '#64748B',
                                        border: 'none',
                                        background: 'transparent',
                                        paddingBottom: '4px',
                                        borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        {/* Pro Search Bar */}
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                            <input
                                placeholder="Filtrar campanhas..."
                                style={{
                                    height: '36px',
                                    width: '260px',
                                    paddingLeft: '32px',
                                    paddingRight: '36px', // Space for badge
                                    borderRadius: '8px',
                                    border: '1px solid #E2E8F0',
                                    background: '#F8FAFC', // Slate 50/50 input
                                    fontSize: '13px',
                                    color: '#0F172A',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => { e.target.style.background = '#FFFFFF'; e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)' }}
                                onBlur={(e) => { e.target.style.background = '#F8FAFC'; e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
                            />
                            {/* Badge */}
                            <div style={{
                                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                height: '20px', padding: '0 6px',
                                borderRadius: '4px', border: '1px solid #E2E8F0', background: '#F1F5F9',
                                color: '#64748B', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace',
                                display: 'flex', alignItems: 'center', pointerEvents: 'none', userSelect: 'none'
                            }}>
                                /
                            </div>
                        </div>
                    </div>

                    {/* Headers */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '40px',
                        background: '#F8FAFC', // Slate 50/50
                        borderBottom: '1px solid #E2E8F0',
                        padding: '0 16px',
                        zIndex: 20,
                        position: 'relative'
                    }}>
                        {columns.map((col, idx) => (
                            <div key={col.key} style={{
                                width: columnWidths[col.key],
                                paddingLeft: idx === 0 ? '16px' : '16px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                color: '#64748B',
                                letterSpacing: '0.05em'
                            }}>
                                {col.label}
                            </div>
                        ))}
                    </div>

                    {/* BODY: Skeleton + Empty State */}
                    <div style={{ position: 'relative', flex: 1, background: '#FFFFFF' }}>

                        {filteredCampaigns.length === 0 && !loading ? (
                            <>
                                {/* Layer 1: Skeleton Background (Visual Texture) */}
                                <div style={{
                                    position: 'absolute', inset: 0, zIndex: 0,
                                    opacity: 0.4,
                                    pointerEvents: 'none'
                                }}>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} style={{
                                            height: '56px',
                                            borderBottom: '1px solid #F8FAFC',
                                            padding: '0 32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '24px',
                                            opacity: 1 - (i * 0.15) // Gradient Fade
                                        }}>
                                            <div style={{ height: '10px', width: '30%', borderRadius: '99px', background: '#E2E8F0' }} />
                                            <div style={{ height: '10px', width: '100px', borderRadius: '99px', background: '#E2E8F0' }} />
                                            <div style={{ height: '10px', width: '60px', borderRadius: '99px', background: '#E2E8F0' }} />
                                        </div>
                                    ))}
                                </div>

                                {/* Layer 2: Hero Empty State (Floating on top) */}
                                <div style={{
                                    position: 'absolute', inset: 0, zIndex: 10,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    backdropFilter: 'blur(2px)'
                                }}>
                                    <div style={{
                                        width: '64px', height: '64px',
                                        borderRadius: '16px',
                                        background: '#F8FAFC',
                                        border: '1px solid #F1F5F9',
                                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: '16px',
                                        color: '#0F172A',
                                        outline: '4px solid #FFFFFF' // Ring effect
                                    }}>
                                        <span style={{ fontSize: '24px' }}>🚀</span>
                                    </div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>Nenhuma campanha encontrada</h3>
                                    <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '320px', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
                                        Sua lista está vazia. Crie automações para engajar seus leads.
                                    </p>
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        style={{
                                            height: '40px', padding: '0 20px',
                                            background: '#0F172A', color: '#FFFFFF',
                                            borderRadius: '8px', border: 'none',
                                            fontSize: '13px', fontWeight: 500,
                                            cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                            transition: 'transform 0.1s'
                                        }}
                                        onActive={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                    >
                                        Criar Campanha
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Active Data Rows */
                            <div style={{ width: '100%' }}>
                                {filteredCampaigns.map((campaign) => (
                                    <div key={campaign.id}
                                        onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
                                        style={{
                                            display: 'flex',
                                            height: '64px', // Taller Rows
                                            alignItems: 'center',
                                            borderBottom: '1px solid #F1F5F9',
                                            padding: '0 16px',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {columns.map((col, idx) => {
                                            const paddingStyle = {
                                                paddingLeft: idx === 0 ? '16px' : '16px',
                                                width: columnWidths[col.key],
                                                fontSize: '13px',
                                                color: '#334155'
                                            };

                                            if (col.key === 'status') {
                                                const isActive = campaign.status === 'active';
                                                return (
                                                    <div key={idx} style={{ ...paddingStyle, display: 'flex', alignItems: 'center' }}>
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusToggle(campaign.id, campaign.status);
                                                            }}
                                                            style={{
                                                                width: '36px', height: '20px',
                                                                background: isActive ? '#10B981' : '#CBD5E1',
                                                                borderRadius: '99px',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.2s',
                                                                display: 'flex', alignItems: 'center', padding: '2px'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '16px', height: '16px',
                                                                background: '#FFFFFF',
                                                                borderRadius: '50%',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                                transform: isActive ? 'translateX(16px)' : 'translateX(0)',
                                                                transition: 'transform 0.2s'
                                                            }} />
                                                        </div>
                                                        <span style={{
                                                            marginLeft: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: isActive ? '#059669' : '#64748B'
                                                        }}>
                                                            {isActive ? 'Ativo' : 'Pausado'}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            if (col.key === 'name') {
                                                return (
                                                    <div key={col.key} style={{ ...paddingStyle, fontWeight: 500, color: '#0F172A' }}>
                                                        {campaign.name}
                                                    </div>
                                                );
                                            }
                                            if (col.key === 'status') {
                                                return (
                                                    <div key={col.key} style={paddingStyle}>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                            padding: '2px 8px', borderRadius: '4px',
                                                            fontSize: '12px', fontWeight: 500,
                                                            background: campaign.status === 'active' ? '#F0FDF4' : '#FFFBEB',
                                                            color: campaign.status === 'active' ? '#166534' : '#B45309',
                                                            border: `1px solid ${campaign.status === 'active' ? '#BBF7D0' : '#FEF3C7'}`
                                                        }}>
                                                            {campaign.status === 'active' ? 'Ativa' : 'Rascunho'}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            if (col.key === 'actions') {
                                                return (
                                                    <div key={col.key} style={paddingStyle}>
                                                        <button style={{ padding: '6px', borderRadius: '4px', color: '#94A3B8', cursor: 'pointer', border: 'none', background: 'transparent' }}>
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            // Default Cell
                                            return (
                                                <div key={col.key} style={paddingStyle}>
                                                    {campaign[col.key] || (col.key === 'rate' ? '0%' : '—')}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            {/* Modal Render */}
            <CampaignCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};

export default CampaignsPage;
