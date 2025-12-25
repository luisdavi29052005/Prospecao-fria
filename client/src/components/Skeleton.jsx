import React from 'react';
import '../index.css';

const Skeleton = ({ width, height, borderRadius, style }) => {
    return (
        <div
            className="skeleton-pulse"
            style={{
                width: width || '100%',
                height: height || '20px',
                backgroundColor: '#27272a', // Dark gray matching theme
                borderRadius: borderRadius || '4px',
                ...style,
            }}
        />
    );
};

export default Skeleton;
