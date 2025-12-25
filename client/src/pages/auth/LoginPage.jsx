import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Check } from 'lucide-react';
import Input from '../../components/Input';
import Button from '../../components/Button';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/app/dashboard');
        } catch (err) {
            setError(err.message || 'Falha ao fazer login');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div style={{ width: '100%', maxWidth: '25rem', margin: '0 auto' }}>

            {/* Social Login Buttons - Top */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={loginWithGoogle}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'white',
                        border: '1px solid #E2E8F0', // Subtle border
                        borderRadius: '8px', // 8px Radius
                        padding: '0.625rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1E293B',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.04-3.71 1.04-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                </button>


            </div>

            {/* Divider */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: '1.5rem 0',
                color: '#94A3B8', // Lighter text
                fontSize: '0.75rem',
                textTransform: 'uppercase'
            }}>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }}></div>
                <span>OU</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }}></div>
            </div>

            <form onSubmit={handleSubmit} className="flex-col gap-6">
                {error && (
                    <div style={{
                        padding: '0.625rem',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '8px',
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}
                <div>
                    <Input
                        label="E-mail"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            backgroundColor: '#FFFFFF', // White BG
                            borderColor: '#E2E8F0', // Light Border
                            borderRadius: '8px', // 8px
                            padding: '0.75rem',
                            color: '#1E293B'
                        }}
                    />
                </div>

                <div>
                    <Input
                        label="Senha"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E2E8F0',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            color: '#1E293B'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                    <div
                        onClick={() => setRememberMe(!rememberMe)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', cursor: 'pointer' }}
                    >
                        <div style={{
                            width: '1.125rem',
                            height: '1.125rem',
                            border: '1px solid #CBD5E1',
                            borderRadius: '4px',
                            background: 'transparent', // Requested: sem fundo sempre
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}>
                            {rememberMe && <Check size={12} color="#3b82f6" strokeWidth={3} />}
                        </div>
                        <span style={{ userSelect: 'none' }}>Manter-me conectado</span>
                    </div>
                    <a href="#" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>Esqueci minha senha</a>
                </div>

                <Button
                    type="submit"
                    fullWidth
                    disableShadow={true}
                    disabled={loading}
                    style={{
                        borderRadius: '8px', // 8px Radius
                        background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)', // Verified Gradient
                        border: 'none',
                        color: 'white',
                        padding: '0.875rem',
                        fontSize: '1rem',
                        fontWeight: 600
                    }}
                >
                    {loading ? 'Entrando...' : 'Entrar'}
                </Button>
            </form>



            <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
                Ainda não possui conta?{' '}
                <Link to="/auth/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
                    Cadastre-se
                </Link>
            </p>
        </div >
    );
};

export default LoginPage;
