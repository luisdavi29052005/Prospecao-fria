import React from 'react';
import { Outlet } from 'react-router-dom';
import '../index.css';

const AuthLayout = () => {
    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            backgroundColor: '#F8FAFC', // Official Light Mode
            overflow: 'hidden'
        }}>
            {/* Left Side - Form Area */}
            <div className="fade-in" style={{
                width: '100%',
                maxWidth: '500px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '40px 60px',
                position: 'relative',
                zIndex: 10,
                backgroundColor: '#F8FAFC' // Match parent
            }}>
                {/* Logo Placeholder */}
                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '24px', color: '#1E293B', letterSpacing: '-0.5px', fontWeight: '800', fontFamily: 'Inter' }}>
                        Prospecção<span style={{ color: '#3B82F6', fontWeight: '400' }}>Fria</span>
                    </h1>
                    <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '8px', fontWeight: '500' }}>
                        Faça login para gerenciar sua organização
                    </p>
                </div>

                <Outlet />
            </div>

            {/* Right Side - Promotional/Blue Area */}
            <div style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgb(96, 165, 250) 0%, rgb(59, 130, 246) 100%)', // Verified Gradient
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                padding: '40px'
            }}>
                {/* Text Content */}
                <div style={{
                    textAlign: 'center',
                    color: 'white',
                    marginBottom: '40px',
                    maxWidth: '600px',
                    zIndex: 2
                }}>
                    <h2 style={{ fontSize: '32px', marginBottom: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        Transforme conversas em vendas
                    </h2>
                    <p style={{ opacity: 0.9, fontSize: '16px', lineHeight: '1.6', fontWeight: '500' }}>
                        Centralize seu atendimento no WhatsApp e potencialize os resultados do seu time comercial.
                    </p>
                </div>

                {/* Mock Interface (Updated 3-Column Layout) */}
                <div className="mock-ui" style={{
                    width: '100%',
                    maxWidth: '700px',
                    background: '#FFFFFF',
                    borderRadius: '24px 24px 0 0',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.25)',
                    padding: '0',
                    transform: 'perspective(1500px) rotateX(10deg) rotateY(-8deg) rotateZ(2deg)', // Better perspective
                    transformOrigin: 'center bottom',
                    transition: 'transform 0.5s ease',
                    zIndex: 2,
                    display: 'flex',
                    height: '400px',
                    overflow: 'hidden',
                    border: '8px solid white'
                }}>
                    {/* Column 1: Mini Sidebar */}
                    <div style={{ width: '60px', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '20px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#3B82F6' }} /> {/* Logo */}
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }} />
                    </div>

                    {/* Column 2: List */}
                    <div style={{ width: '240px', background: '#F8FAFC', borderRight: '1px solid #E2E8F0', padding: '20px' }}>
                        {/* Horizon Header Helper */}
                        <div style={{ height: '32px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ width: '80px', height: '14px', background: '#CBD5E1', borderRadius: '4px' }} />
                        </div>
                        {/* List Items */}
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E2E8F0', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ width: '80%', height: '8px', background: '#CBD5E1', borderRadius: '4px', marginBottom: '6px' }} />
                                    <div style={{ width: '50%', height: '6px', background: '#E2E8F0', borderRadius: '4px' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Column 3: Chat Area */}
                    <div style={{ flex: 1, background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
                        {/* Chat Header */}
                        <div style={{ height: '64px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9' }} />
                            <div style={{ width: '100px', height: '10px', background: '#E2E8F0', borderRadius: '4px' }} />
                        </div>

                        {/* Chat Bubbles */}
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ alignSelf: 'flex-start', padding: '12px', background: '#F1F5F9', borderRadius: '12px 12px 12px 2px', width: '60%' }}>
                                <div style={{ width: '90%', height: '8px', background: '#E2E8F0', borderRadius: '4px' }} />
                            </div>
                            <div style={{ alignSelf: 'flex-end', padding: '12px', background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)', borderRadius: '12px 12px 2px 12px', width: '50%' }}>
                                <div style={{ width: '80%', height: '8px', background: 'rgba(255,255,255,0.4)', borderRadius: '4px' }} />
                            </div>
                        </div>

                        {/* Floating Input Pill */}
                        <div style={{ marginTop: 'auto', marginBottom: '24px', margin: '0 24px 24px 24px', height: '48px', borderRadius: '24px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <div style={{ marginLeft: 'auto', marginRight: '4px', width: '40px', height: '40px', borderRadius: '50%', background: '#3B82F6' }} />
                        </div>
                    </div>
                </div>

                {/* Decorative Circles */}
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.1)',
                    pointerEvents: 'none'
                }}></div>
            </div>
        </div>
    );
};

export default AuthLayout;
