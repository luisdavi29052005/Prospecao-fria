import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const SettingsInput = ({ label, ...props }) => (
    <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--slate-700)',
            marginBottom: '6px'
        }}>
            {label}
        </label>
        <input
            {...props}
            style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                lineHeight: '20px',
                color: 'var(--slate-900)',
                background: '#FFFFFF',
                border: '1px solid var(--slate-300)',
                borderRadius: '8px',
                outline: 'none',
                transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
                e.target.style.borderColor = 'var(--indigo-500)';
                e.target.style.boxShadow = '0 0 0 3px var(--indigo-100)';
            }}
            onBlur={(e) => {
                e.target.style.borderColor = 'var(--slate-300)';
                e.target.style.boxShadow = 'none';
            }}
        />
    </div>
);

const SettingsPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        gemini_key: '',
        backend_url: '',
        apify_token: '',
        waha_url: ''
    });

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setConfig({
                    gemini_key: data.gemini_key || '',
                    backend_url: data.backend_url || '',
                    apify_token: data.apify_token || '',
                    waha_url: data.waha_url || ''
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    user_id: user.id,
                    ...config,
                    updated_at: new Date()
                }, { onConflict: 'user_id' });

            if (error) throw error;
            addToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error.message);
            addToast('Erro ao salvar configurações.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100%',
            background: 'var(--slate-50)',
            padding: '40px 20px'
        }}>
            <div style={{ maxWidth: '768px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: 600,
                        color: 'var(--slate-900)',
                        marginBottom: '8px'
                    }}>
                        Configurações
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--slate-500)' }}>
                        Gerencie as integrações e chaves de API do sistema.
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid var(--slate-200)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '24px 32px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '24px',
                            paddingBottom: '24px',
                            borderBottom: '1px solid var(--slate-100)'
                        }}>
                            <div style={{
                                width: '36px', height: '36px',
                                borderRadius: '8px',
                                background: 'var(--indigo-50)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--indigo-600)'
                            }}>
                                <Settings size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--slate-800)' }}>
                                    Integrações
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleSave}>
                            <SettingsInput
                                label="Gemini API Key"
                                name="gemini_key"
                                placeholder="sk-..."
                                value={config.gemini_key}
                                onChange={handleChange}
                                disabled={loading}
                                type="password"
                            />

                            <SettingsInput
                                label="Backend URL"
                                name="backend_url"
                                placeholder="https://api.seubackend.com"
                                value={config.backend_url}
                                onChange={handleChange}
                                disabled={loading}
                            />

                            <SettingsInput
                                label="Apify Token"
                                name="apify_token"
                                placeholder="apify_api_..."
                                value={config.apify_token}
                                onChange={handleChange}
                                disabled={loading}
                                type="password"
                            />

                            <SettingsInput
                                label="Waha Base URL"
                                name="waha_url"
                                placeholder="http://localhost:3000"
                                value={config.waha_url}
                                onChange={handleChange}
                                disabled={loading}
                            />

                            <div style={{
                                marginTop: '32px',
                                paddingTop: '24px',
                                borderTop: '1px solid var(--slate-100)',
                                display: 'flex',
                                justifySelf: 'flex-end',
                                flexDirection: 'row-reverse'
                            }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: 'var(--indigo-600)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.7 : 1,
                                        boxShadow: 'var(--shadow-primary)',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--indigo-700)')}
                                    onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--indigo-600)')}
                                >
                                    <Save size={16} />
                                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
