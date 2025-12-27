import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const AgentsPage = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ name: '', model: 'gemini-2.5-flash', temperature: 0.7, systemPrompt: '' });

    // Chat Test State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);

    // Fetch Agents
    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedAgents = data.map(a => ({
                id: a.id,
                name: a.name,
                model: a.model,
                temperature: a.temperature,
                systemPrompt: a.system_prompt,
            }));

            setAgents(mappedAgents);
        } catch (error) {
            console.error('Error fetching agents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAgent = (agent) => {
        setSelectedAgentId(agent.id);
        setIsCreating(false);
        setFormData({ ...agent });
        setChatMessages([]);
    };

    const handleNewAgent = () => {
        setIsCreating(true);
        setSelectedAgentId(null);
        setFormData({ name: '', model: 'gemini-2.5-flash', temperature: 0.7, systemPrompt: '' });
        setChatMessages([]);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || sendingMessage) return;

        const userText = chatInput;
        setChatInput('');
        setSendingMessage(true);

        const newUserMsg = { role: 'user', content: userText };
        const currentHistory = [...chatMessages, newUserMsg];
        setChatMessages(currentHistory);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/chat`, {
                model: formData.model,
                history: currentHistory,
                systemPrompt: formData.systemPrompt
            });

            const result = response.data.response;

            if (result && result.messages && Array.isArray(result.messages)) {
                if (result.thought) {
                    setChatMessages(prev => [...prev, {
                        role: 'system',
                        content: `🧠 ${result.thought}`,
                        isThought: true
                    }]);
                }
                const newMessages = result.messages.map(text => ({
                    role: 'assistant',
                    content: text
                }));
                setChatMessages(prev => [...prev, ...newMessages]);
            } else if (typeof result === 'string') {
                setChatMessages(prev => [...prev, { role: 'assistant', content: result }]);
            } else {
                setChatMessages(prev => [...prev, { role: 'assistant', content: "Erro: Formato de resposta inválido." }]);
            }

        } catch (error) {
            console.error('Chat Error:', error);
            let errorMessage = 'Erro ao conectar. Tente novamente.';
            if (error.response?.status === 429) {
                errorMessage = '⚠️ Cota excedida (Erro 429).';
            }
            setChatMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Você precisa estar logado.');
                return;
            }

            const payload = {
                user_id: user.id,
                name: formData.name,
                model: formData.model,
                temperature: formData.temperature,
                system_prompt: formData.systemPrompt
            };

            let error;
            if (selectedAgentId) {
                const { error: updateError } = await supabase
                    .from('agents')
                    .update(payload)
                    .eq('id', selectedAgentId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('agents')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            await fetchAgents();
            if (!selectedAgentId) setIsCreating(false);
            // alert('Atendente salvo com sucesso!'); // Removed alert for smoother flow

        } catch (error) {
            console.error('Error saving agent:', error);
            alert('Erro ao salvar atendente.');
        }
    };

    const handleDelete = async () => {
        if (!selectedAgentId) return;
        if (window.confirm('Excluir este atendente?')) {
            try {
                const { error } = await supabase
                    .from('agents')
                    .delete()
                    .eq('id', selectedAgentId);

                if (error) throw error;
                setAgents(agents.filter(a => a.id !== selectedAgentId));
                setSelectedAgentId(null);
            } catch (error) {
                console.error('Error deleting agent:', error);
                alert('Erro ao excluir atendente.');
            }
        }
    };

    const showWorkspace = selectedAgentId || isCreating;
    const isEmpty = !loading && agents.length === 0 && !isCreating;

    return (
        <div style={{ height: '100%', display: 'flex', background: 'var(--slate-50)', overflow: 'hidden' }}>
            {/* Left Column - List */}
            <div style={{
                width: '320px',
                minWidth: '320px',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--slate-200)',
                background: '#FFFFFF',
                zIndex: 10
            }}>
                <div style={{
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    borderBottom: '1px solid var(--slate-100)'
                }}>
                    <h1 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-900)', margin: 0 }}>
                        Meus Atendentes
                    </h1>
                    <button
                        onClick={handleNewAgent}
                        style={{
                            width: '28px', height: '28px',
                            borderRadius: '6px',
                            background: 'var(--indigo-600)',
                            border: 'none',
                            color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-primary)'
                        }}
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--slate-400)', fontSize: '13px' }}>Carregando...</div>}
                    {!loading && agents.map(agent => {
                        const isActive = selectedAgentId === agent.id;
                        return (
                            <div
                                key={agent.id}
                                onClick={() => handleSelectAgent(agent)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 24px',
                                    borderBottom: '1px solid var(--slate-50)',
                                    cursor: 'pointer',
                                    background: isActive ? 'var(--indigo-50)' : '#FFFFFF',
                                    borderLeft: isActive ? '3px solid var(--indigo-600)' : '3px solid transparent',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'var(--slate-50)')}
                                onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = '#FFFFFF')}
                            >
                                <div style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '8px',
                                    background: isActive ? '#FFFFFF' : 'var(--slate-100)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isActive ? 'var(--indigo-600)' : 'var(--slate-500)',
                                    marginRight: '12px'
                                }}>
                                    <Bot size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-900)', marginBottom: '2px' }}>
                                        {agent.name}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            background: isActive ? 'var(--indigo-100)' : 'var(--slate-100)',
                                            color: isActive ? 'var(--indigo-700)' : 'var(--slate-600)',
                                            borderRadius: '4px',
                                            fontWeight: 500
                                        }}>
                                            {agent.model}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Column - Workspace */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--slate-50)' }}>
                {showWorkspace ? (
                    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Header Card */}
                        <div style={{
                            background: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid var(--slate-200)',
                            boxShadow: 'var(--shadow-sm)',
                            padding: '16px 24px',
                            marginBottom: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--slate-900)', margin: 0 }}>
                                    {isCreating ? 'Novo Atendente' : formData.name}
                                </h2>
                                <p style={{ fontSize: '13px', color: 'var(--slate-500)', margin: '4px 0 0 0' }}>
                                    Configure a personalidade e o conhecimento da IA.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {!isCreating && (
                                    <button
                                        onClick={handleDelete}
                                        style={{
                                            background: 'var(--slate-100)',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--slate-100)'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    style={{
                                        padding: '8px 20px',
                                        background: 'var(--indigo-600)',
                                        color: 'white',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: 500,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        boxShadow: 'var(--shadow-primary)'
                                    }}
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>

                        {/* Content Grid */}
                        <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                            {/* Configuration Config */}
                            <div style={{
                                flex: 1,
                                background: '#FFFFFF',
                                borderRadius: '12px',
                                border: '1px solid var(--slate-200)',
                                boxShadow: 'var(--shadow-sm)',
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                overflowY: 'auto'
                            }}>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--slate-700)', marginBottom: '8px' }}>Nome do Atendente</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex: Assistente de Vendas"
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid var(--slate-300)',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                outline: 'none',
                                                color: 'var(--slate-900)'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--indigo-500)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--slate-300)'}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--slate-700)', marginBottom: '8px' }}>Modelo de IA</label>
                                        <select
                                            value={formData.model}
                                            onChange={e => setFormData({ ...formData, model: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid var(--slate-300)',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                outline: 'none',
                                                background: 'white',
                                                color: 'var(--slate-900)'
                                            }}
                                        >
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--slate-700)', marginBottom: '8px' }}>
                                        System Prompt (Instruções)
                                    </label>
                                    <textarea
                                        value={formData.systemPrompt}
                                        onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                                        placeholder="Você é um assistente útil e amigável..."
                                        style={{
                                            flex: 1,
                                            width: '100%',
                                            border: '1px solid var(--slate-300)',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            fontSize: '14px',
                                            lineHeight: '1.6',
                                            fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
                                            resize: 'none',
                                            outline: 'none',
                                            color: 'var(--slate-800)',
                                            background: 'var(--slate-50)'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.background = '#FFFFFF';
                                            e.target.style.borderColor = 'var(--indigo-500)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.background = 'var(--slate-50)';
                                            e.target.style.borderColor = 'var(--slate-300)';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Preview Chat */}
                            <div style={{
                                width: '380px',
                                background: '#FFFFFF',
                                borderRadius: '12px',
                                border: '1px solid var(--slate-200)',
                                boxShadow: 'var(--shadow-sm)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}>
                                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Teste em Tempo Real
                                    </h3>
                                </div>
                                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#FFFFFF' }}>
                                    {chatMessages.length === 0 && (
                                        <div style={{ textAlign: 'center', color: 'var(--slate-400)', fontSize: '13px', marginTop: '40px' }}>
                                            Escreva algo para testar o comportamento...
                                        </div>
                                    )}
                                    {chatMessages.map((msg, index) => (
                                        <div key={index} style={{
                                            display: 'flex',
                                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{
                                                background: msg.role === 'user' ? 'var(--indigo-600)' : 'var(--slate-100)',
                                                color: msg.role === 'user' ? 'white' : 'var(--slate-800)',
                                                padding: '8px 12px',
                                                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                                fontSize: '13px',
                                                maxWidth: '85%',
                                                lineHeight: '1.4'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {sendingMessage && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                            <div style={{
                                                background: 'var(--slate-100)',
                                                padding: '8px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                color: 'var(--slate-500)'
                                            }}>
                                                Digitando...
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '16px', borderTop: '1px solid var(--slate-100)' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Digite sua mensagem..."
                                            disabled={sendingMessage}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--slate-300)',
                                                fontSize: '13px',
                                                outline: 'none'
                                            }}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={sendingMessage}
                                            style={{
                                                background: 'var(--slate-900)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '0 12px',
                                                fontSize: '13px',
                                                cursor: sendingMessage ? 'default' : 'pointer'
                                            }}
                                        >
                                            Enviar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : isEmpty ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '64px', height: '64px',
                                background: 'var(--indigo-50)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 24px auto',
                                color: 'var(--indigo-600)'
                            }}>
                                <Bot size={32} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--slate-900)', marginBottom: '8px' }}>
                                Comece criando seu primeiro atendente
                            </h3>
                            <p style={{ color: 'var(--slate-500)', fontSize: '14px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                                Crie perfis de inteligência artificial personalizados para atender seus clientes automaticamente no WhatsApp.
                            </p>
                            <button
                                onClick={handleNewAgent}
                                style={{
                                    padding: '10px 24px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: 'white',
                                    background: 'var(--indigo-600)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: 'var(--shadow-primary)'
                                }}
                            >
                                Criar Novo Atendente
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)' }}>
                        <p>Selecione um atendente para editar</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentsPage;
