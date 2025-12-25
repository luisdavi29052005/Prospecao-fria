import React, { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import Button from '../../components/Button';
import Input from '../../components/Input';

const CampaignsPage = () => {
    // Basic placeholder state
    const [loading, setLoading] = useState(false);

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
                        <Megaphone size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Nova Campanha</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Crie e gerencie suas campanhas de prospecção</p>
                </div>

                <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', color: '#71717a', padding: '2rem 0' }}>
                        <p>O formulário de criação de campanhas será implementado aqui.</p>
                        <Button
                            style={{
                                marginTop: '1rem',
                                background: 'var(--primary)',
                                color: 'white'
                            }}
                            onClick={() => alert('Em breve!')}
                        >
                            <Plus size={18} />
                            Criar Campanha
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CampaignsPage;
