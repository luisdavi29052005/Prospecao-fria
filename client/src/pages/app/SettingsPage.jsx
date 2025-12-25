import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { useToast } from '../../context/ToastContext';

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

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
                throw error;
            }

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
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: '2rem'
        }}>
            <div style={{ width: '100%', maxWidth: '30rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '0.75rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto'
                    }}>
                        <Settings size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Configurações do Sistema</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Configure as integrações externas</p>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Input
                        label="Gemini API Key"
                        name="gemini_key"
                        placeholder="sk-..."
                        value={config.gemini_key}
                        onChange={handleChange}
                        disabled={loading}
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)' }}
                    />

                    <Input
                        label="Backend URL"
                        name="backend_url"
                        placeholder="https://api.seubackend.com"
                        value={config.backend_url}
                        onChange={handleChange}
                        disabled={loading}
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)' }}
                    />

                    <Input
                        label="Apify Token"
                        name="apify_token"
                        placeholder="apify_api_..."
                        value={config.apify_token}
                        onChange={handleChange}
                        disabled={loading}
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)' }}
                    />

                    <Input
                        label="Waha Base URL"
                        name="waha_url"
                        placeholder="http://localhost:3000"
                        value={config.waha_url}
                        onChange={handleChange}
                        disabled={loading}
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)' }}
                    />

                    <Button
                        type="submit"
                        disabled={loading}
                        fullWidth // Making it consistent with login
                        disableShadow={true}
                        style={{
                            marginTop: '1rem',
                            borderRadius: '1.5rem', // Rounded pill button
                            background: '#27272a', // Dark gray
                            border: '1px solid #3f3f46',
                            color: 'white',
                            padding: '0.875rem',
                            fontSize: '1rem',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        <Save size={18} style={{ marginRight: '8px' }} />
                        {loading ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;
