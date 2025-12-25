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

    // Session Actions
    startSession: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}/start`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to start session');
        return response.json();
    },

    stopSession: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}/stop`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to stop session');
        return response.json();
    },

    logoutSession: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}/logout`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to logout session');
        return response.json();
    },

    getMe: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}/me`);
        if (!response.ok) throw new Error('Failed to get session info');
        return response.json();
    },

    restartSession: async (session) => {
        const response = await fetch(`${API_URL}/sessions/${session}/restart`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to restart session');
        return response.json();
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
    }
};
