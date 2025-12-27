import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';

const CampaignCreateModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('geral');
    const [loading, setLoading] = useState(false);

    // Real Data State
    const [agents, setAgents] = useState([]);
    const [sessions, setSessions] = useState([]);

    const [formData, setFormData] = useState({
        // Geral
        name: '',
        description: '',
        // Produto
        offer_type: 'service', // 'product' | 'service'
        product_name: '',
        product_price: '',
        campaign_goal: 'meeting', // 'meeting', 'sale', 'link', 'qualification'
        selling_points: [], // Array of strings
        // Leads
        leads_source: '', // 'apify', 'csv', 'manual'
        leads_file: null,
        // Atendente & Conexão
        agent_id: '',
        session_name: '',

        // Apify Search
        apify_search_term: '',
        apify_location: '',
        apify_max_results: '10', // Default 10
        apify_leads: [], // Leads encontrados
        apify_selected_leads: [], // IDs dos leads selecionados

        // Manual Entry
        manual_leads: [], // [{ name: '', phone: '' }]
        manual_name_input: '',
        manual_phone_input: ''
    });

    const [isSearchingApify, setIsSearchingApify] = useState(false);
    const [searchStatus, setSearchStatus] = useState(''); // 'initializing', 'running', 'completed'

    // Fetch Agents & Sessions on Mount
    React.useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    // 1. Fetch Agents
                    const { data: agentsData, error: agentsError } = await supabase
                        .from('agents')
                        .select('id, name, model');

                    if (!agentsError) setAgents(agentsData || []);

                    // 2. Fetch Sessions (via backend proxy or direct if configured)
                    // Assuming we have a cached list or fetch fresh
                    const res = await fetch('http://localhost:8000/api/waha/sessions');
                    if (res.ok) {
                        const sessionsData = await res.json();
                        // Filter only WORKING sessions ideally, but show all for now
                        setSessions(sessionsData || []);
                    }
                } catch (error) {
                    console.error('Error loading form data:', error);
                }
            };
            fetchData();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Polling Logic (Preserved)
    const pollResults = async (runId, userId) => {
        try {
            const response = await fetch(`http://localhost:8000/api/apify/poll/${runId}?userId=${userId}`);
            const data = await response.json();

            if (data.success) {
                const leadsWithId = data.leads.map((l, index) => ({
                    ...l,
                    _id: `lead_${runId}_${index}`
                }));

                setFormData(prev => ({
                    ...prev,
                    apify_leads: leadsWithId,
                    apify_selected_leads: leadsWithId.map(l => l._id)
                }));

                if (data.status === 'SUCCEEDED' || data.status === 'FAILED' || data.status === 'ABORTED' || data.status === 'TIMED-OUT') {
                    setIsSearchingApify(false);
                    setSearchStatus(data.status === 'SUCCEEDED' ? 'Concluído' : 'Finalizado');
                    return true;
                } else {
                    setSearchStatus(`Buscando... (${leadsWithId.length} encontrados)`);
                    return false;
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
        return false;
    };

    const handleApifySearch = async () => {
        if (!formData.apify_search_term || !formData.apify_location) {
            alert('Preencha o termo de busca e a localização.');
            return;
        }

        setIsSearchingApify(true);
        setSearchStatus('Iniciando...');
        setFormData(prev => ({ ...prev, apify_leads: [], apify_selected_leads: [] }));

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const response = await fetch('http://localhost:8000/api/apify/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id || 'anon', // Fallback for safety
                    searchTerms: formData.apify_search_term,
                    location: formData.apify_location,
                    maxResults: parseInt(formData.apify_max_results) || 10
                })
            });

            const data = await response.json();

            if (data.success && data.runId) {
                setSearchStatus('Buscando...');
                const intervalId = setInterval(async () => {
                    const shouldStop = await pollResults(data.runId, user ? user.id : 'anon');
                    if (shouldStop) {
                        clearInterval(intervalId);
                    }
                }, 3000);
            } else {
                alert('Erro ao iniciar busca: ' + data.error);
                setIsSearchingApify(false);
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('Erro ao buscar leads.');
            setIsSearchingApify(false);
        }
    };

    const toggleLeadSelection = (leadId) => {
        setFormData(prev => {
            const currentSelected = prev.apify_selected_leads;
            if (currentSelected.includes(leadId)) {
                return { ...prev, apify_selected_leads: currentSelected.filter(id => id !== leadId) };
            } else {
                return { ...prev, apify_selected_leads: [...currentSelected, leadId] };
            }
        });
    };

    const toggleSellingPoint = (point) => {
        setFormData(prev => {
            const current = prev.selling_points;
            if (current.includes(point)) {
                return { ...prev, selling_points: current.filter(p => p !== point) };
            } else {
                return { ...prev, selling_points: [...current, point] };
            }
        });
    };

    const toggleAllLeads = () => {
        setFormData(prev => {
            if (prev.apify_selected_leads.length === prev.apify_leads.length) {
                return { ...prev, apify_selected_leads: [] };
            } else {
                return { ...prev, apify_selected_leads: prev.apify_leads.map(l => l._id) };
            }
        });
    };

    // Manual Lead Handlers
    const handleAddManualLead = () => {
        if (!formData.manual_name_input || !formData.manual_phone_input) {
            alert('Preencha nome e telefone');
            return;
        }
        const newLead = {
            id: Date.now().toString(),
            name: formData.manual_name_input,
            phone: formData.manual_phone_input
        };
        setFormData(prev => ({
            ...prev,
            manual_leads: [...prev.manual_leads, newLead],
            manual_name_input: '',
            manual_phone_input: ''
        }));
    };

    const handleRemoveManualLead = (id) => {
        setFormData(prev => ({
            ...prev,
            manual_leads: prev.manual_leads.filter(l => l.id !== id)
        }));
    };

    const tabs = [
        { key: 'geral', label: 'Geral' },
        { key: 'produto', label: 'Produto' },
        { key: 'leads', label: 'Leads' },
        { key: 'atendente', label: 'Atendente' },
        { key: 'revisar', label: 'Revisar' }
    ];

    const currentTabIndex = tabs.findIndex(t => t.key === activeTab);

    // Animation Variants
    const slideVariants = {
        enter: { x: 20, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 },
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isStepValid = (step) => {
        switch (step) {
            case 'geral':
                return formData.name.trim().length > 0;
            case 'produto':
                return formData.product_name.trim().length > 0;
            case 'leads':
                return formData.leads_source !== '';
            case 'atendente':
                return formData.agent_id !== '' && formData.session_name !== '';
            case 'revisar':
                return true;
            default:
                return false;
        }
    };

    const canProceed = isStepValid(activeTab);

    const handleNext = () => {
        if (!canProceed) return;
        if (currentTabIndex < tabs.length - 1) {
            setActiveTab(tabs[currentTabIndex + 1].key);
        }
    };

    const handleTabChange = (tabKey) => {
        const targetIndex = tabs.findIndex(t => t.key === tabKey);
        if (targetIndex <= currentTabIndex) {
            setActiveTab(tabKey);
        } else {
            let canJump = true;
            for (let i = 0; i < targetIndex; i++) {
                if (!isStepValid(tabs[i].key)) {
                    canJump = false;
                    break;
                }
            }
            if (canJump) {
                setActiveTab(tabKey);
            }
        }
    };

    const handlePrev = () => {
        if (currentTabIndex > 0) {
            setActiveTab(tabs[currentTabIndex - 1].key);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) return;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('Usuário não autenticado');
                return;
            }

            // 1. Create Campaign
            const { data: campaign, error } = await supabase
                .from('campaigns')
                .insert({
                    user_id: user.id,
                    name: formData.name,
                    description: formData.description,
                    agent_id: formData.agent_id,
                    session_name: formData.session_name,
                    status: 'paused', // Start paused by default per user request
                    offer_context: {
                        type: formData.offer_type,
                        product: formData.product_name,
                        price: formData.product_price,
                        goal: formData.campaign_goal,
                        selling_points: formData.selling_points
                    }
                })
                .select()
                .single();

            if (error) throw error;

            console.log('Campaign created:', campaign);

            // 2. Import Leads (Basic CSV/Apify Logic placeholder)
            if (formData.apify_leads.length > 0) {
                const selected = formData.apify_leads.filter(l => formData.apify_selected_leads.includes(l._id));

                const leadsToInsert = selected.map(lead => ({
                    campaign_id: campaign.id,
                    phone: lead.phone, // Ensure normalization later
                    name: lead.name,
                    status: 'pending',
                    custom_fields: { source: 'apify', ...lead }
                }));

                if (leadsToInsert.length > 0) {
                    const { error: leadsError } = await supabase
                        .from('campaign_leads')
                        .insert(leadsToInsert);

                    if (leadsError) console.error('Error importing leads:', leadsError);
                }
            }

            // 3. Import Manual Leads
            if (formData.manual_leads.length > 0) {
                const leadsToInsert = formData.manual_leads.map(lead => ({
                    campaign_id: campaign.id,
                    phone: lead.phone,
                    name: lead.name,
                    status: 'pending',
                    custom_fields: { source: 'manual' }
                }));

                if (leadsToInsert.length > 0) {
                    const { error: leadsError } = await supabase
                        .from('campaign_leads')
                        .insert(leadsToInsert);

                    if (leadsError) console.error('Error importing leads:', leadsError);
                }
            }

            onClose(); // Close modal on success
            window.location.reload(); // Simple refresh to show new data
        } catch (error) {
            console.error('Error creating campaign:', error);
            alert('Erro ao criar campanha: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Premium Input Styles
    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        fontSize: '14px',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        outline: 'none',
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '6px'
    };

    const renderTabContent = () => {
        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="space-y-6"
                >
                    {activeTab === 'geral' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                    Informações Gerais
                                </h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>
                                    Defina a identidade principal da sua campanha.
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>Nome da Campanha</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Ex: Prospecção Q3 - Varejo"
                                    style={inputStyle}
                                    className="premium-input"
                                />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>Descrição (opcional)</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Descreva o objetivo desta campanha..."
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                    className="premium-input"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'produto' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                    O que você vende?
                                </h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>
                                    A IA adapta o discurso baseado no tipo de oferta.
                                </p>
                            </div>

                            {/* Type Selector */}
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                                {[
                                    { key: 'service', label: 'Serviço', icon: '⚡', desc: 'Consultoria, Software, Agência...' },
                                    { key: 'product', label: 'Produto', icon: '📦', desc: 'E-commerce, Varejo, Físico...' }
                                ].map(type => (
                                    <div
                                        key={type.key}
                                        onClick={() => setFormData(prev => ({ ...prev, offer_type: type.key }))}
                                        style={{
                                            flex: 1,
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: formData.offer_type === type.key ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                                            background: formData.offer_type === type.key ? '#EEF2FF' : '#FFFFFF',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '8px',
                                            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '20px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)'
                                        }}>
                                            {type.icon}
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: 600, color: formData.offer_type === type.key ? '#4F46E5' : '#1E293B', marginBottom: '2px' }}>
                                                {type.label}
                                            </p>
                                            <p style={{ fontSize: '11px', color: '#64748B' }}>{type.desc}</p>
                                        </div>
                                        <div style={{ marginLeft: 'auto' }}>
                                            <div style={{
                                                width: '18px', height: '18px',
                                                borderRadius: '50%',
                                                border: formData.offer_type === type.key ? '5px solid #4F46E5' : '2px solid #CBD5E1',
                                                background: '#FFFFFF'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={labelStyle}>Nome do {formData.offer_type === 'service' ? 'Serviço' : 'Produto'}</label>
                                    <input
                                        type="text"
                                        name="product_name"
                                        value={formData.product_name}
                                        onChange={handleChange}
                                        placeholder={formData.offer_type === 'service' ? "Ex: Consultoria Jurídica" : "Ex: iPhone 15 Pro"}
                                        style={inputStyle}
                                        className="premium-input"
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Valor</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{
                                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                                            color: '#64748B', fontSize: '14px', fontWeight: 500
                                        }}>R$</span>
                                        <input
                                            type="text" // Keep text to allow formatting if needed, typically use number or mask library
                                            name="product_price"
                                            value={formData.product_price}
                                            onChange={(e) => {
                                                // Simple numeric/comma filter
                                                const val = e.target.value.replace(/[^0-9,.]/g, '');
                                                setFormData(prev => ({ ...prev, product_price: val }));
                                            }}
                                            placeholder="0,00"
                                            style={{ ...inputStyle, paddingLeft: '40px' }}
                                            className="premium-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>Objetivo Principal</label>
                                <select
                                    name="campaign_goal"
                                    value={formData.campaign_goal}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                                    className="premium-input"
                                >
                                    <option value="meeting">📅 Agendar Reunião</option>
                                    <option value="sale">💰 Venda Direta</option>
                                    <option value="link">🔗 Enviar Link/Material</option>
                                    <option value="qualification">🔍 Apenas Qualificar</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>Pontos Fortes (Selecione)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {[
                                        'Atendimento 24/7', 'Garantia Estendida', 'Frete Grátis',
                                        'Pagamento Flexível', 'Exclusividade', 'Alta Qualidade',
                                        'Preço Competitivo', 'Suporte Premium', 'Tecnologia de Ponta',
                                        'Reembolso Garantido', 'Instalação Grátis', 'Bônus Incluso'
                                    ].map(point => (
                                        <button
                                            key={point}
                                            onClick={() => toggleSellingPoint(point)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                border: formData.selling_points.includes(point) ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                                                background: formData.selling_points.includes(point) ? '#EEF2FF' : '#F8FAFC',
                                                color: formData.selling_points.includes(point) ? '#4F46E5' : '#64748B',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {formData.selling_points.includes(point) ? '✓ ' : '+ '}{point}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>
                                    A IA usará esses argumentos para persuadir o lead.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'leads' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                    Importar Leads
                                </h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>
                                    Escolha a fonte dos seus contatos.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                                {[
                                    { key: 'apify', title: 'Google Maps', icon: '🗺️' },
                                    { key: 'csv', title: 'Arquivo CSV', icon: '📁' },
                                    { key: 'manual', title: 'Manual', icon: '✏️' }
                                ].map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => setFormData(prev => ({ ...prev, leads_source: option.key }))}
                                        style={{
                                            flex: 1,
                                            padding: '24px 16px',
                                            border: formData.leads_source === option.key ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                                            borderRadius: '12px',
                                            background: formData.leads_source === option.key ? '#EEF2FF' : '#FFFFFF',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s',
                                            boxShadow: formData.leads_source === option.key ? '0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06)' : 'none'
                                        }}
                                    >
                                        <span style={{ fontSize: '28px' }}>{option.icon}</span>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: formData.leads_source === option.key ? '#4F46E5' : '#64748B' }}>
                                            {option.title}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {formData.leads_source === 'apify' && (
                                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                                    <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
                                        {/* ... Apify content (omitted here for brevity, keeping existing structure reference logic) ... */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Termo de Busca</label>
                                                <input
                                                    type="text"
                                                    name="apify_search_term"
                                                    value={formData.apify_search_term}
                                                    onChange={handleChange}
                                                    placeholder="Ex: Restaurantes"
                                                    style={inputStyle}
                                                    className="premium-input"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Localização</label>
                                                <input
                                                    type="text"
                                                    name="apify_location"
                                                    value={formData.apify_location}
                                                    onChange={handleChange}
                                                    placeholder="Ex: São Paulo, SP"
                                                    style={inputStyle}
                                                    className="premium-input"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Limite</label>
                                                <input
                                                    type="number"
                                                    name="apify_max_results"
                                                    value={formData.apify_max_results}
                                                    onChange={handleChange}
                                                    min="1"
                                                    max="100"
                                                    style={inputStyle}
                                                    className="premium-input"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={handleApifySearch}
                                                disabled={isSearchingApify}
                                                style={{
                                                    padding: '10px 24px',
                                                    background: '#4F46E5',
                                                    color: '#FFFFFF',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    cursor: isSearchingApify ? 'not-allowed' : 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                                                }}
                                            >
                                                {isSearchingApify ? 'Buscando...' : 'Buscar Leads'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Results Table */}
                                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                                        <div style={{ background: '#FAFAFA', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Resultados da Busca</span>
                                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                                                {searchStatus || (formData.apify_leads.length > 0 ? `${formData.apify_leads.length} leads` : 'Aguardando busca')}
                                            </span>
                                        </div>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                                                    <tr>
                                                        <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px', borderBottom: '1px solid #E2E8F0' }}>
                                                            <input
                                                                type="checkbox"
                                                                onChange={toggleAllLeads}
                                                                checked={formData.apify_leads.length > 0 && formData.apify_selected_leads.length === formData.apify_leads.length}
                                                            />
                                                        </th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>Nome</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>Telefone</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formData.apify_leads.length > 0 ? (
                                                        formData.apify_leads.map((lead, index) => (
                                                            <tr key={lead._id || index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                                <td style={{ padding: '12px 16px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={formData.apify_selected_leads.includes(lead._id)}
                                                                        onChange={() => toggleLeadSelection(lead._id)}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '12px 16px', color: '#1E293B' }}>{lead.name}</td>
                                                                <td style={{ padding: '12px 16px', color: '#64748B' }}>{lead.phone}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                                                                {isSearchingApify ? 'Buscando...' : 'Nenhum lead encontrado'}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.leads_source === 'manual' && (
                                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                                    <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px', alignItems: 'end' }}>
                                            <div>
                                                <label style={labelStyle}>Nome do Cliente</label>
                                                <input
                                                    type="text"
                                                    name="manual_name_input"
                                                    value={formData.manual_name_input}
                                                    onChange={handleChange}
                                                    placeholder="João Silva"
                                                    style={inputStyle}
                                                    className="premium-input"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>WhatsApp (com DDD)</label>
                                                <input
                                                    type="text"
                                                    name="manual_phone_input"
                                                    value={formData.manual_phone_input}
                                                    onChange={handleChange}
                                                    placeholder="5511999999999"
                                                    style={inputStyle}
                                                    className="premium-input"
                                                />
                                            </div>
                                            <div>
                                                <button
                                                    onClick={handleAddManualLead}
                                                    style={{
                                                        padding: '12px 24px',
                                                        background: '#4F46E5',
                                                        color: '#FFFFFF',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: 500,
                                                        width: '100%',
                                                        height: '45px' // Match input height roughly
                                                    }}
                                                >
                                                    Adicionar
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Manual List Table */}
                                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                                        <div style={{ background: '#FAFAFA', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Lista Manual</span>
                                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>{formData.manual_leads.length} leads adicionados</span>
                                        </div>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                                                    <tr>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>Nome</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>Telefone</th>
                                                        <th style={{ padding: '10px 16px', textAlign: 'right', width: '50px', borderBottom: '1px solid #E2E8F0' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formData.manual_leads.length > 0 ? (
                                                        formData.manual_leads.map((lead) => (
                                                            <tr key={lead.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                                <td style={{ padding: '12px 16px', color: '#1E293B' }}>{lead.name}</td>
                                                                <td style={{ padding: '12px 16px', color: '#64748B' }}>{lead.phone}</td>
                                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                                    <button
                                                                        onClick={() => handleRemoveManualLead(lead.id)}
                                                                        style={{ color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                                                                Nenhum lead manual adicionado ainda.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'atendente' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                    Selecionar Atendente & Conexão
                                </h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>
                                    Quem será o responsável e por onde ele vai falar?
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>Atendente IA (Cérebro)</label>
                                <select
                                    name="agent_id"
                                    value={formData.agent_id}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, background: '#FFFFFF', cursor: 'pointer' }}
                                    className="premium-input"
                                >
                                    <option value="">Selecione um agente...</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.name} ({agent.model})
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                                    O Agente define o tom de voz e personalidade.
                                </p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={labelStyle}>WhatsApp Conectado (Boca)</label>
                                <select
                                    name="session_name"
                                    value={formData.session_name}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, background: '#FFFFFF', cursor: 'pointer' }}
                                    className="premium-input"
                                >
                                    <option value="">Selecione uma conexão...</option>
                                    {sessions.map(session => (
                                        <option key={session.name} value={session.name}>
                                            {session.name} ({session.status})
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                                    Número por onde as mensagens serão enviadas.
                                </p>
                            </div>
                        </div>
                    )}


                    {activeTab === 'revisar' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                    Revisar Campanha
                                </h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>
                                    Tudo pronto? Vamos lançar!
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    <h4 style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Campanha</h4>
                                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>{formData.name || 'Sem nome'}</p>
                                    <p style={{ fontSize: '14px', color: '#64748B' }}>{formData.description || 'Sem descrição'}</p>
                                </div>
                                <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    <h4 style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Leads</h4>
                                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
                                        {formData.leads_source === 'apify' ? `${formData.apify_selected_leads.length} via Google` :
                                            formData.leads_source === 'manual' ? `${formData.manual_leads.length} Manuais` : 'Arquivo CSV'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        );
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.4)', // backdrop
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '24px'
        }}>
            <style>{`
                .premium-input:focus {
                    border-color: #4F46E5 !important;
                    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1) !important;
                }
            `}</style>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{
                    width: '100%',
                    maxWidth: '900px', // Reduced max-width
                    height: '650px',   // Fixed height for wizard
                    maxHeight: '90vh',
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative' // Ensure relative positioning for absolute footer
                }}
            >
                {/* 1. Modal Header */}
                <header style={{
                    height: '64px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 32px',
                    borderBottom: '1px solid #F1F5F9',
                    background: '#FFFFFF'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                            <span style={{ fontSize: '16px' }}>🚀</span>
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Nova Campanha</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94A3B8',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* 2. Main Content (Split View) */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* Left: Navigation (Cleaner Text-Only) */}
                    <aside style={{
                        width: '240px',
                        flexShrink: 0,
                        borderRight: '1px solid #F1F5F9',
                        background: '#FFFFFF',
                        padding: '32px 20px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ padding: '0 12px', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 600, margin: 0 }}>
                                Etapas
                            </h2>
                        </div>

                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {tabs.map((tab, idx) => {
                                const isActive = activeTab === tab.key;
                                const isCompleted = idx < currentTabIndex;
                                const isClickable = idx <= currentTabIndex;

                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => isClickable && handleTabChange(tab.key)}
                                        style={{
                                            display: 'flex',
                                            width: '100%',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px 12px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            borderRadius: '8px',
                                            textAlign: 'left',
                                            background: isActive ? '#F8FAFC' : 'transparent',
                                            color: isActive ? '#4F46E5' : isCompleted ? '#334155' : '#64748B',
                                            border: 'none',
                                            cursor: isClickable ? 'pointer' : 'default',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            display: 'flex',
                                            height: '24px',
                                            width: '24px',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '50%',
                                            background: isActive ? '#EEF2FF' : isCompleted ? '#F1F5F9' : '#F8FAFC',
                                            color: isActive ? '#4F46E5' : isCompleted ? '#0F172A' : '#94A3B8',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            {isCompleted ? <CheckCircle size={14} /> : idx + 1}
                                        </span>
                                        <span style={{ fontWeight: isActive ? 600 : 500 }}>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Right: Form Canvas (Centered & Animated) */}
                    <main style={{
                        flex: 1,
                        overflowY: 'auto',
                        background: '#FFFFFF',
                        position: 'relative',
                        padding: '0'
                    }}>
                        <div style={{
                            minHeight: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            paddingBottom: '80px' // Space for footer
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '640px',
                                margin: '0 auto',
                                padding: '48px 40px',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center'
                            }}>
                                {renderTabContent()}
                            </div>
                        </div>

                        {/* Fixed Footer within Main Area to overlap content if needed, or stick to bottom of Main */}
                        <div style={{
                            height: '72px',
                            borderTop: '1px solid #F1F5F9',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 40px',
                            position: 'absolute',
                            bottom: 0,
                            width: '100%',
                            zIndex: 10
                        }}>
                            <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                                Passo {currentTabIndex + 1} de {tabs.length}
                            </span>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={currentTabIndex === 0 ? onClose : handlePrev}
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#64748B',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {currentTabIndex === 0 ? 'Cancelar' : 'Voltar'}
                                </button>

                                <button
                                    onClick={activeTab === 'revisar' ? handleSubmit : handleNext}
                                    disabled={!canProceed && activeTab !== 'revisar'}
                                    style={{
                                        padding: '8px 20px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        background: (activeTab === 'revisar' ? formData.name.trim() : canProceed) ? '#4F46E5' : '#E2E8F0',
                                        color: (activeTab === 'revisar' ? formData.name.trim() : canProceed) ? '#FFFFFF' : '#94A3B8',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: (activeTab === 'revisar' ? formData.name.trim() : canProceed) ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {activeTab === 'revisar' ? (
                                        <>
                                            {loading ? 'Criando...' : 'Lançar'}
                                            {!loading && <CheckCircle size={16} />}
                                        </>
                                    ) : (
                                        <>
                                            Continuar
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </main>
                </div>
            </motion.div>
        </div>
    );
};

export default CampaignCreateModal;
