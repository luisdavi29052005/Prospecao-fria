import React from 'react';

const CampaignTabs = ({ tabs, activeTab, onTabChange, isCreateMode = false }) => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF',
            height: '48px',
            flexShrink: 0,
            width: '100%'
        }}>
            {tabs.map((tab, idx) => {
                const isActive = activeTab === tab.key;
                const isCompleted = isCreateMode && idx < tabs.findIndex(t => t.key === activeTab);

                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                            marginBottom: '-1px',
                            cursor: 'pointer',
                            color: isActive ? '#3B82F6' : isCompleted ? '#10B981' : '#64748B',
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 500,
                            transition: 'all 0.2s'
                        }}
                    >
                        {/* Step Number for Create Mode */}
                        {isCreateMode && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: isActive ? '#3B82F6' : isCompleted ? '#10B981' : '#E2E8F0',
                                color: isActive || isCompleted ? '#FFFFFF' : '#64748B'
                            }}>
                                {isCompleted ? '✓' : idx + 1}
                            </span>
                        )}

                        {/* Icon */}
                        {tab.icon && !isCreateMode && (
                            <span style={{ display: 'flex' }}>{tab.icon}</span>
                        )}

                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

export default CampaignTabs;
