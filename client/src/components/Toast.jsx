
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} color="#10b981" />;
            case 'error': return <AlertTriangle size={20} color="#ef4444" />;
            case 'info': return <Info size={20} color="#3b82f6" />;
            default: return <CheckCircle size={20} color="#10b981" />;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return 'rgba(16, 185, 129, 0.2)';
            case 'error': return 'rgba(239, 68, 68, 0.2)';
            default: return 'var(--glass-border)';
        }
    };

    return (
        <div style={{
            background: '#FFFFFF', // White background
            backdropFilter: 'blur(12px)',
            border: `1px solid ${getBorderColor()}`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '300px',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', // Softer shadow
            transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
            opacity: isVisible ? 1 : 0,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 99999
        }} onClick={handleClose}>
            <div style={{ flexShrink: 0 }}>
                {getIcon()}
            </div>
            <p style={{
                margin: 0,
                color: '#1E293B', // Dark text
                fontSize: '0.9rem',
                fontWeight: 500,
                flex: 1
            }}>
                {message}
            </p>
            {/* Optional Close Button */}
            {/* <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={16} />
            </button> */}
        </div>
    );
};

export default Toast;
