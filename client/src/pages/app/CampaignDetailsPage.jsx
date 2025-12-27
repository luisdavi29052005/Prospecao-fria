import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Upload, MoreHorizontal, Users, Package, Bot, Settings, Trash2 } from 'lucide-react';
import CampaignTabs from '../../components/CampaignTabs';
import { supabase } from '../../lib/supabaseClient';

const CampaignDetailsPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [campaign, setCampaign] = useState(null);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('leads');
    const [agentsList, setAgentsList] = useState([]);

    const tabs = [
        { key: 'leads', label: 'Leads', icon: <Users size={16} /> },
        { key: 'produto', label: 'Produto', icon: <Package size={16} /> },
        { key: 'atendente', label: 'Atendente', icon: <Bot size={16} /> },
        { key: 'configuracoes', label: 'Configurações', icon: <Settings size={16} /> }
    ];

    useEffect(() => {
        const fetchCampaignData = async () => {
            try {
                // 1. Fetch Campaign Details
                const { data: campaignData, error: campaignError } = await supabase
                    .from('campaigns')
                    .select('*, agents(name, model)')
                    .eq('id', id)
                    .single();

                if (campaignError) throw campaignError;

                // 2. Fetch Agents for Selector
                const { data: agentsData } = await supabase.from('agents').select('id, name');
                setAgentsList(agentsData || []);

                // 2. Fetch Leads Count & Stats
                const { count: totalLeads } = await supabase
                    .from('campaign_leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('campaign_id', id);

                // TODO: Fetch leads list (limited for now)
                const { data: leadsData } = await supabase
                    .from('campaign_leads')
                    .select('*')
                    .eq('campaign_id', id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                setCampaign({
                    ...campaignData,
                    agent_name: campaignData.agents?.name || '?',
                    leads_count: totalLeads || 0,
                    // Parse offer_context if it exists
                    offer_context: campaignData.offer_context || {},
                    settings: campaignData.settings || {}
                });

                setLeads(leadsData || []);

            } catch (error) {
                console.error('Error loading campaign:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchCampaignData();
    }, [id]);

    const handleUpdateCampaign = async (updates) => {
        try {
            const { error } = await supabase
                .from('campaigns')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            // Refresh local state
            setCampaign(prev => ({ ...prev, ...updates }));
            alert('Campanha atualizada!');
        } catch (error) {
            console.error('Error updating:', error);
            alert('Erro ao atualizar');
        }
    };

    const handleOfferUpdate = (field, value) => {
        const newContext = { ...campaign.offer_context, [field]: value };
        setCampaign(prev => ({ ...prev, offer_context: newContext }));
    };

    const saveOfferChanges = () => {
        handleUpdateCampaign({ offer_context: campaign.offer_context });
    };

    const leadsColumns = [
        { key: 'name', label: 'Nome', width: 180 },
        { key: 'phone', label: 'Telefone', width: 140 },
        { key: 'status', label: 'Status', width: 120 },
        { key: 'last_message', label: 'Última Mensagem', width: 200 },
        { key: 'updated_at', label: 'Atualizado', width: 140 },
        { key: 'actions', label: 'Ações', width: 100 }
    ];

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        fontSize: '14px',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        outline: 'none'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '8px'
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'leads':
                return (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Stats Bar */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid #E2E8F0',
                            display: 'flex',
                            gap: '32px',
                            background: '#FAFAFA',
                            flexShrink: 0
                        }}>
                            <div>
                                <p style={{ fontSize: '12px', color: '#64748B', margin: 0, marginBottom: '4px' }}>Leads</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', margin: 0 }}>{campaign?.leads_count || 0}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', color: '#64748B', margin: 0, marginBottom: '4px' }}>Responderam</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', margin: 0 }}>{campaign?.responded || 0}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', color: '#64748B', margin: 0, marginBottom: '4px' }}>Negociando</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: '#3B82F6', margin: 0 }}>{campaign?.negotiating || 0}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', color: '#64748B', margin: 0, marginBottom: '4px' }}>Ganhos</p>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: '#10B981', margin: 0 }}>{campaign?.won || 0}</p>
                            </div>
                        </div>

                        {/* Leads Table */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        {leadsColumns.map((col, idx) => (
                                            <th
                                                key={col.key}
                                                style={{
                                                    padding: '12px 16px',
                                                    textAlign: 'left',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    color: '#64748B',
                                                    width: col.width,
                                                    borderRight: idx < leadsColumns.length - 1 ? '1px solid #F1F5F9' : 'none',
                                                    background: '#FAFAFA'
                                                }}
                                            >
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length === 0 ? (
                                        <tr>
                                            <td colSpan={leadsColumns.length} style={{ padding: '80px 20px', textAlign: 'center', color: '#94A3B8' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '64px', height: '64px', borderRadius: '16px', background: '#F1F5F9',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Upload size={24} color="#94A3B8" />
                                                    </div>
                                                    <p style={{ fontSize: '15px', fontWeight: 500, color: '#64748B' }}>Nenhum lead importado</p>
                                                    <button style={{
                                                        padding: '10px 20px', background: '#3B82F6', color: '#FFFFFF',
                                                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                                                        fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px'
                                                    }}>
                                                        <Upload size={16} />
                                                        Importar Leads
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        leads.map((lead) => (
                                            <tr
                                                key={lead.id}
                                                style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#FAFAFA'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1E293B' }}>{lead.name}</td>
                                                <td style={{ padding: '12px 16px', color: '#64748B' }}>{lead.phone}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500,
                                                        background: '#ECFDF5', color: '#059669'
                                                    }}>{lead.status}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {lead.last_message || '—'}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '13px' }}>{lead.updated_at || '—'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button style={{
                                                        padding: '6px', background: 'transparent', border: '1px solid #E2E8F0',
                                                        borderRadius: '6px', cursor: 'pointer', color: '#64748B'
                                                    }}>
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

                return (
                    <div style={{ padding: '32px 24px', maxWidth: '800px' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
                                Oferta & Estratégia
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748B' }}>
                                Edite o que a IA está vendendo e como ela deve abordar os leads.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div>
                                <label style={labelStyle}>Nome do Produto/Serviço</label>
                                <input
                                    type="text"
                                    value={campaign?.offer_context?.product || ''}
                                    onChange={(e) => handleOfferUpdate('product', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Preço Base</label>
                                <input
                                    type="text"
                                    value={campaign?.offer_context?.price || ''}
                                    onChange={(e) => handleOfferUpdate('price', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Objetivo Principal</label>
                            <select
                                value={campaign?.offer_context?.goal || 'meeting'}
                                onChange={(e) => handleOfferUpdate('goal', e.target.value)}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="meeting">📅 Agendar Reunião</option>
                                <option value="sale">💰 Venda Direta</option>
                                <option value="link">🔗 Enviar Link/Material</option>
                                <option value="qualification">🔍 Apenas Qualificar</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Pontos Fortes (Tags)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                {(campaign?.offer_context?.selling_points || []).map((point, idx) => (
                                    <span key={idx} style={{
                                        padding: '6px 12px', background: '#EEF2FF', color: '#4F46E5',
                                        borderRadius: '20px', fontSize: '13px', fontWeight: 500,
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        {point}
                                        <button
                                            onClick={() => {
                                                const newPoints = campaign.offer_context.selling_points.filter((_, i) => i !== idx);
                                                handleOfferUpdate('selling_points', newPoints);
                                            }}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#4F46E5', padding: 0 }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {/* Simple Add Tag Input could go here, for now relying on pre-sets or just viewing */}
                            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
                                Adicione tags para guiar os argumentos da IA (Edição de tags em breve).
                            </p>
                        </div>

                        <button
                            onClick={saveOfferChanges}
                            style={{
                                padding: '10px 24px', background: '#2563EB', color: '#FFFFFF',
                                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500
                            }}>
                            Salvar Alterações
                        </button>
                    </div>
                );

            case 'atendente':
                return (
                    <div style={{ padding: '32px 24px', maxWidth: '600px' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={labelStyle}>Atendente IA</label>
                            <select
                                value={campaign?.agent_id || ''}
                                onChange={(e) => handleUpdateCampaign({ agent_id: e.target.value })}
                                style={{ ...inputStyle, background: '#FFFFFF', cursor: 'pointer' }}
                            >
                                <option value="">Selecione um atendente...</option>
                                {agentsList.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                            O Atendente gera as respostas usando a personalidade definida.
                        </p>
                    </div>
                );

            case 'configuracoes':
                return (
                    <div style={{ padding: '32px 24px', maxWidth: '600px', overflowY: 'auto' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>Controle de Execução</h3>
                            <p style={{ fontSize: '14px', color: '#64748B' }}>Defina quando e como a campanha deve rodar.</p>
                        </div>

                        {/* Status Toggle Card */}
                        <div style={{
                            padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0',
                            background: campaign?.status === 'active' ? '#F0FDF4' : '#FEF2F2',
                            marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                                    {campaign?.status === 'active' ? 'Campanha Ativa' : 'Campanha Pausada'}
                                </h4>
                                <p style={{ fontSize: '13px', color: '#64748B' }}>
                                    {campaign?.status === 'active'
                                        ? 'O sistema está buscando leads pendentes para contatar.'
                                        : 'Nenhuma mensagem será enviada enquanto estiver pausada.'}
                                </p>
                            </div>
                            <button
                                onClick={() => handleUpdateCampaign({ status: campaign?.status === 'active' ? 'paused' : 'active' })}
                                style={{
                                    padding: '10px 20px',
                                    background: campaign?.status === 'active' ? '#F59E0B' : '#10B981',
                                    color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                {campaign?.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                                {campaign?.status === 'active' ? 'Pausar' : 'Ativar'}
                            </button>
                        </div>

                        {/* Trigger Mode Settings */}
                        <div style={{ marginBottom: '32px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Modo de Operação</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                                    border: campaign?.settings?.trigger_type === 'online' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                                    background: campaign?.settings?.trigger_type === 'online' ? '#EFF6FF' : '#FFFFFF',
                                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                    <input
                                        type="radio"
                                        name="trigger_type"
                                        value="online"
                                        checked={campaign?.settings?.trigger_type === 'online'}
                                        onChange={() => handleUpdateCampaign({ settings: { ...campaign.settings, trigger_type: 'online' } })}
                                        style={{ marginTop: '4px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>🎯 Modo Sniper (Quando ficar Online)</div>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                                            O sistema monitora o status do lead. A mensagem é enviada <b>apenas</b> quando o lead ficar "Online" no WhatsApp.
                                        </p>
                                    </div>
                                </label>

                                <label style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                                    border: (!campaign?.settings?.trigger_type || campaign?.settings?.trigger_type === 'interval') ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                                    background: (!campaign?.settings?.trigger_type || campaign?.settings?.trigger_type === 'interval') ? '#EFF6FF' : '#FFFFFF',
                                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                    <input
                                        type="radio"
                                        name="trigger_type"
                                        value="interval"
                                        checked={!campaign?.settings?.trigger_type || campaign?.settings?.trigger_type === 'interval'}
                                        onChange={() => handleUpdateCampaign({ settings: { ...campaign.settings, trigger_type: 'interval' } })}
                                        style={{ marginTop: '4px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>⏱️ Modo Fila (Intervalo Definido)</div>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                                            O sistema processa a lista sequencialmente, respeitando o intervalo de tempo definido abaixo.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Scheduling Settings */}
                        <div style={{ marginBottom: '32px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Horário de Envio</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Início Diário</label>
                                    <input
                                        type="time"
                                        value={campaign?.settings?.daily_start || '09:00'}
                                        onChange={(e) => handleUpdateCampaign({ settings: { ...campaign.settings, daily_start: e.target.value } })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Fim Diário</label>
                                    <input
                                        type="time"
                                        value={campaign?.settings?.daily_end || '18:00'}
                                        onChange={(e) => handleUpdateCampaign({ settings: { ...campaign.settings, daily_end: e.target.value } })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>
                                Mensagens só serão enviadas dentro deste intervalo (Horário Local).
                            </p>
                        </div>

                        {/* Throttling Settings - Only show for Interval Mode */}
                        {(!campaign?.settings?.trigger_type || campaign?.settings?.trigger_type === 'interval') && (
                            <div style={{ marginBottom: '32px' }}>
                                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Cadência</h4>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Intervalo entre Mensagens (segundos)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        value={campaign?.settings?.message_interval || 60}
                                        onChange={(e) => handleUpdateCampaign({ settings: { ...campaign.settings, message_interval: parseInt(e.target.value) } })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Limite de Leads por Dia</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={campaign?.settings?.max_leads_per_day || 50}
                                        onChange={(e) => handleUpdateCampaign({ settings: { ...campaign.settings, max_leads_per_day: parseInt(e.target.value) } })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Danger Zone */}
                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '24px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444', marginBottom: '12px' }}>Zona de Perigo</h3>
                            <button
                                onClick={async () => {
                                    if (window.confirm('Tem certeza que deseja excluir esta campanha? Os leads serão perdidos.')) {
                                        const { error } = await supabase.from('campaigns').delete().eq('id', id);
                                        if (!error) navigate('/app/campaigns');
                                    }
                                }}
                                style={{
                                    padding: '10px 20px', background: '#FEF2F2', color: '#EF4444',
                                    border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center'
                                }}>
                                <Trash2 size={16} />
                                Excluir Campanha Permanentemente
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p>Carregando...</p>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            width: '100%',
            background: '#FFFFFF',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                height: '64px',
                minHeight: '64px',
                padding: '0 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => navigate('/app/campaigns')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '36px', height: '36px', background: 'transparent',
                            border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', color: '#64748B'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                                {campaign?.name || 'Campanha'}
                            </h2>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                                background: campaign?.status === 'active' ? '#ECFDF5' : '#FEF9C3',
                                color: campaign?.status === 'active' ? '#059669' : '#CA8A04'
                            }}>
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: campaign?.status === 'active' ? '#10B981' : '#EAB308'
                                }} />
                                {campaign?.status === 'active' ? 'Executando' : 'Pausada'}
                            </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                            {campaign?.description || 'Sem descrição'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Header actions removed in favor of Tab controls */}
                </div>
            </div>

            {/* Tabs */}
            <CampaignTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isCreateMode={false}
            />

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderTabContent()}
            </div>
        </div>
    );
};

export default CampaignDetailsPage;
