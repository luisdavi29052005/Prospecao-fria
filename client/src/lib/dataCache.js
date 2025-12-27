// Simple memory cache to prevent skeletons on navigation
// Data persists until page refresh

export const appCache = {
    // Structure: { [sessionName]: [leads] }
    chats: {},

    // Structure: [campaigns]
    campaigns: null,

    // Structure: { [chatId]: [messages] }
    messages: {},

    // Timestamps to optionally invalidate if too old (not implementing complexity yet)
    lastUpdated: {}
};

export const setChatCache = (sessionName, data) => {
    if (!sessionName) return;
    appCache.chats[sessionName] = data;
};

export const getChatCache = (sessionName) => {
    if (!sessionName) return null;
    return appCache.chats[sessionName];
};

export const setMessageCache = (chatId, data) => {
    if (!chatId) return;
    appCache.messages[chatId] = data;
};

export const getMessageCache = (chatId) => {
    if (!chatId) return null;
    return appCache.messages[chatId];
};

export const setCampaignsCache = (data) => {
    appCache.campaigns = data;
};

export const getCampaignsCache = () => {
    return appCache.campaigns;
};
