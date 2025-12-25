import React from 'react';
import Skeleton from '../Skeleton';

const AppSkeleton = () => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            {/* Sidebar Skeleton (Matching Fixed Sidebar) */}
            <div style={{
                width: '4rem',
                borderRight: '1px solid var(--glass-border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1rem 0',
                gap: '2rem',
                position: 'fixed',
                left: 0,
                top: 0,
                height: '100vh',
                zIndex: 50
            }}>
                {/* Logo Placeholder */}
                <Skeleton width="2rem" height="2rem" borderRadius="0.5rem" />

                {/* Nav Items Placeholders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} width="2.5rem" height="2.5rem" borderRadius="8px" />
                    ))}
                </div>

                {/* Profile Placeholder (Bottom) */}
                <div style={{ marginTop: 'auto' }}>
                    <Skeleton width="2rem" height="2rem" borderRadius="50%" />
                </div>
            </div>

            {/* Main Content Skeleton (Matching DashboardLayout Main) */}
            <main style={{
                marginLeft: '4rem',
                flex: 1,
                width: 'calc(100% - 4rem)',
                padding: '40px',
                position: 'relative'
            }}>
                {/* Header Skeleton */}
                <div className="glass-card" style={{
                    padding: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '40px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Skeleton width="150px" height="32px" />
                        <Skeleton width="200px" height="16px" />
                    </div>
                    <Skeleton width="100px" height="40px" borderRadius="12px" />
                </div>

                {/* Grid Content Skeleton */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="glass-card" style={{ padding: '24px', height: '200px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Skeleton width="40%" height="24px" />
                            <Skeleton width="100%" height="60px" />
                            <Skeleton width="60%" height="16px" style={{ marginTop: 'auto' }} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default AppSkeleton;
