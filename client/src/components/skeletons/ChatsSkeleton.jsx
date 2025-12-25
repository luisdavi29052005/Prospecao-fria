
import React from 'react';
import Skeleton from '../Skeleton';

const ChatsSkeleton = () => {
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            width: '100%',
            overflow: 'hidden',
            background: '#F8FAFC'
        }}>
            {/* Left Panel: Chat List Skeleton */}
            <div style={{
                width: '360px',
                borderRight: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                background: '#FFFFFF',
                flexShrink: 0
            }}>
                {/* HORIZON HEADER: Title (64px) */}
                <div style={{
                    height: '64px',
                    padding: '0 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Skeleton width="100px" height="20px" />
                    <Skeleton width="60px" height="24px" borderRadius="6px" />
                </div>

                {/* SATELLITE SEARCH: Strip (52px) */}
                <div style={{
                    height: '52px',
                    padding: '0 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <Skeleton width="16px" height="16px" borderRadius="4px" />
                    <Skeleton width="100%" height="16px" borderRadius="4px" />
                </div>

                {/* Flat Chat List Items */}
                <div style={{ padding: 0, flex: 1, overflowY: 'auto' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} style={{
                            display: 'flex',
                            gap: '16px',
                            padding: '16px 20px',
                            borderBottom: '1px solid #F1F5F9', // Flat list divider
                            alignItems: 'center'
                        }}>
                            <Skeleton width="40px" height="40px" borderRadius="50%" />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Skeleton width="100px" height="14px" />
                                    <Skeleton width="30px" height="10px" />
                                </div>
                                <Skeleton width="140px" height="12px" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Chat Area Skeleton */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: '#F8FAFC'
            }}>
                {/* Chat Header Skeleton (64px Horizon) */}
                <div style={{
                    height: '64px',
                    padding: '0 24px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    background: '#FFFFFF'
                }}>
                    <Skeleton width="40px" height="40px" borderRadius="50%" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <Skeleton width="120px" height="14px" />
                        <Skeleton width="80px" height="10px" />
                    </div>
                </div>

                {/* Messages Area */}
                <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Incoming message */}
                    <div style={{ display: 'flex', gap: '8px', maxWidth: '60%' }}>
                        <Skeleton width="28px" height="28px" borderRadius="50%" />
                        <Skeleton width="200px" height="50px" borderRadius="18px" />
                    </div>
                    {/* Outgoing message */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Skeleton width="160px" height="45px" borderRadius="18px" />
                    </div>
                    {/* Incoming message */}
                    <div style={{ display: 'flex', gap: '8px', maxWidth: '60%' }}>
                        <Skeleton width="28px" height="28px" borderRadius="50%" />
                        <Skeleton width="240px" height="70px" borderRadius="18px" />
                    </div>
                </div>

                {/* Input Area Skeleton - Minimalist Satellite */}
                <div style={{
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    background: '#FFFFFF',
                    borderTop: '1px solid #E2E8F0'
                }}>
                    <Skeleton width="32px" height="32px" borderRadius="50%" />
                    <Skeleton width="100%" height="48px" borderRadius="24px" style={{ flex: 1 }} />
                    <Skeleton width="48px" height="48px" borderRadius="50%" />
                </div>
            </div>
        </div>
    );
};

export default ChatsSkeleton;
