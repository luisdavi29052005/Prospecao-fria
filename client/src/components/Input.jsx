import React from 'react';
import '../index.css';

const Input = ({
    label,
    type = "text",
    placeholder,
    icon: Icon,
    error,
    style, // Accept custom styles
    labelStyle, // New prop for label customization
    ...props
}) => {
    return (
        <div className="flex-col gap-2" style={{ width: '100%' }}>
            {label && (
                <label style={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: '#1E293B', // Default to Darker for generalized use, or override
                    marginBottom: '4px',
                    ...labelStyle // Allow override
                }}>
                    {label}
                </label>
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {Icon && (
                    <div style={{
                        position: 'absolute',
                        left: '12px',
                        color: '#9ca3af',
                        display: 'flex',
                        zIndex: 1
                    }}>
                        <Icon size={18} />
                    </div>
                )}

                <input
                    type={type}
                    placeholder={placeholder}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingLeft: Icon ? '40px' : '16px',
                        backgroundColor: '#18181b', // Default dark
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'all 0.2s',
                        ...style // Apply override styles
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; // Subtle Glow
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = style?.borderColor || '#27272a';
                        e.target.style.boxShadow = 'none';
                    }}
                    {...props}
                />
            </div>

            {error && (
                <span style={{
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    marginTop: '4px'
                }}>
                    {error}
                </span>
            )}
        </div>
    );
};

export default Input;
