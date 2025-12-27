import { io } from 'socket.io-client';

const API_URL = 'http://localhost:8000/api/waha';
const SOCKET_URL = 'http://localhost:8000';

const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
});

export const wahaService = {
    socket,
    // Sessions
    getSessions: async () => {
        try {
            const response = await fetch(`${API_URL}/sessions`);
            if (!response.ok) {
                console.error('Failed to fetch sessions:', response.status);
                return []; // Return empty array instead of throwing
            }
            return response.json();
        } catch (error) {
            console.error('Error fetching sessions:', error.message);
            return []; // Return empty array on network error
        }
    },

    createSession: async (payload) => {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to create session');
        return response.json();
    },

    getSession: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        return response.json();
    },

    // Session Actions - DIRECT WAHA CALLS (localhost:3000)
    startSession: async (session) => {
        const response = await fetch(`http://localhost:3000/api/sessions/${session}/start`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to start session');
        return true;
    },

    stopSession: async (session) => {
        const response = await fetch(`http://localhost:3000/api/sessions/${session}/stop`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to stop session');
        return true;
    },

    logoutSession: async (session) => {
        const response = await fetch(`http://localhost:3000/api/sessions/${session}/logout`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to logout session');
        return true;
    },

    getMe: async (session) => {
        // Keep getMe on proxy for now unless requested otherwise, or safer to stick to pattern? 
        // User said "put all these route configurations to work right". 
        // getMe wasn't explicitly listed but fits "Session Management". 
        // I will leave getMe as is for now to avoid side effects, focusing on the 4 requested verbs.
        const response = await fetch(`${API_URL}/sessions/${session}/me`);
        if (!response.ok) throw new Error('Failed to get session info');
        return response.json();
    },

    restartSession: async (session) => {
        // Note: WAHA typically uses POST for restart
        const response = await fetch(`http://localhost:3000/api/sessions/${session}/restart`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to restart session');
        return true;
    },

    // QR Code / Auth
    getQRCode: async (session) => {
        try {
            const response = await fetch(`${API_URL}/sessions/${session}/auth/qr`);
            if (!response.ok) return null;
            return response.json();
        } catch (error) {
            console.error('Error getting QR code:', error.message);
            return null;
        }
    },

    getScreenshot: async (session) => {
        try {
            const response = await fetch(`${API_URL}/sessions/${session}/screenshot`);
            if (!response.ok) return null;
            return response.json();
        } catch (error) {
            console.error('Error getting screenshot:', error.message);
            return null;
        }
    },

    subscribePresence: async (session, chatId) => {
        try {
            await fetch(`${API_URL}/sessions/${session}/presence/${chatId}/subscribe`, { method: 'POST' });
        } catch (error) {
            console.error('Error subscribing presence:', error);
        }
    },

    // Message Sending
    sendText: async (payload) => {
        const response = await fetch(`${API_URL}/sendText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send text');
        return response.json();
    },

    sendImage: async (payload) => {
        const response = await fetch(`${API_URL}/sendImage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send image');
        return response.json();
    },

    sendFile: async (payload) => {
        const response = await fetch(`${API_URL}/sendFile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send file');
        return response.json();
    },

    sendVoice: async (payload) => {
        const response = await fetch(`${API_URL}/sendVoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send voice');
        return response.json();
    },

    sendVideo: async (payload) => {
        const response = await fetch(`${API_URL}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to send video');
        return response.json();
    },

    // Media Conversion
    convertVoice: async (session, file) => {
        try {
            // 1. Try to get the WAHA URL from the backend config
            const configRes = await fetch(`${API_URL}/config`);
            const config = configRes.ok ? await configRes.json() : { baseUrl: 'http://localhost:3000/api' };
            const wahaBase = config.baseUrl.replace(/\/$/, '');

            const formData = new FormData();
            formData.append('file', file);

            // 2. Try calling WAHA directly (User's preferred method)
            let directUrl = wahaBase;
            const endpoint = `/${session}/media/convert/voice`;
            if (directUrl.endsWith('/api')) {
                directUrl += endpoint;
            } else {
                directUrl += '/api' + endpoint;
            }

            console.log(`🎬 Attempting direct conversion: ${directUrl}`);
            const response = await fetch(directUrl, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Direct conversion failed');
            return response.blob();
        } catch (err) {
            console.warn('⚠️ Direct conversion failed (CORS or server down), trying proxy:', err.message);
            // 3. Fallback to proxy (Port 8000) - I've fixed the 500 error there
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_URL}/${session}/media/convert/voice`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Failed to convert voice via proxy');
            return response.blob();
        }
    },

    convertVideo: async (session, file) => {
        try {
            const configRes = await fetch(`${API_URL}/config`);
            const config = configRes.ok ? await configRes.json() : { baseUrl: 'http://localhost:3000/api' };
            const wahaBase = config.baseUrl.replace(/\/$/, '');

            const formData = new FormData();
            formData.append('file', file);

            // Same logic for video
            let directUrl = wahaBase;
            const endpoint = `/${session}/media/convert/video`;
            if (directUrl.endsWith('/api')) {
                directUrl += endpoint;
            } else {
                directUrl += '/api' + endpoint;
            }

            console.log(`🎬 Attempting direct conversion: ${directUrl}`);
            const response = await fetch(directUrl, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Direct conversion failed');
            return response.blob();
        } catch (err) {
            console.warn('⚠️ Direct conversion failed, trying proxy:', err.message);
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_URL}/${session}/media/convert/video`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Failed to convert video via proxy');
            return response.blob();
        }
    }
};
