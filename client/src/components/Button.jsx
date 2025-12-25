import React from 'react';
import '../index.css';

const Button = ({
    children,
    variant = 'primary',
    fullWidth = false,
    icon: Icon,
    disabled,
    onClick,
    type = 'button',
    disableShadow = false,
    ...props
}) => {

    const getBaseStyles = () => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 24px',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.95rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        transition: 'all var(--transition-fast)',
        border: 'none',
        opacity: disabled ? 0.7 : 1,
        position: 'relative',
        overflow: 'hidden',
    });

    const getVariantStyles = () => {
        switch (variant) {
            case 'outline':
                return {
                    background: 'transparent',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                };
            case 'google':
                return {
                    background: 'white',
                    color: 'black',
                    border: '1px solid white',
                };
            case 'ghost':
                return {
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                };
            case 'primary':
            default:
                return {
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    color: 'white',
                    boxShadow: disableShadow ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.3)',
                };
        }
    };

    const styles = { ...getBaseStyles(), ...getVariantStyles(), ...props.style };

    return (
        <button
            type={type}
            style={styles}
            disabled={disabled}
            onClick={onClick}
            onMouseEnter={(e) => {
                if (!disabled && variant !== 'ghost') {
                    // Removed movement
                    // e.target.style.transform = 'translateY(-1px)';

                    // Lighten color slightly
                    e.target.style.filter = 'brightness(1.2)';

                    if (variant === 'primary' && !disableShadow) e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
                    if (variant === 'outline') e.target.style.borderColor = 'var(--text-secondary)';
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled && variant !== 'ghost') {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.filter = 'brightness(1)'; // Reset brightness

                    if (variant === 'primary' && !disableShadow) e.target.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.3)';
                    if (variant === 'primary' && disableShadow) e.target.style.boxShadow = 'none';
                    if (variant === 'outline') e.target.style.borderColor = 'var(--glass-border)';
                }
            }}
        >
            {Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

export default Button;
