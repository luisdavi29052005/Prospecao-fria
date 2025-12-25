const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get WAHA configuration from DB
const getWahaConfig = async () => {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('waha_url')
            .limit(1);

        if (error) throw error;

        const settings = data && data.length > 0 ? data[0] : null;

        return {
            baseUrl: settings?.waha_url || 'http://localhost:3000',
            apiKey: ''
        };
    } catch (err) {
        console.error('Error fetching system settings:', err.message);
        return { baseUrl: 'http://localhost:3000', apiKey: '' };
    }
};

// Create axios request helper
const createWahaRequest = async (method, endpoint, data = null) => {
    const config = await getWahaConfig();
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'accept': 'application/json'
    };

    if (config.apiKey) {
        headers['X-Api-Key'] = config.apiKey;
    }

    try {
        const axiosConfig = { method, url, headers };
        if (data !== null && data !== undefined) {
            axiosConfig.data = data;
        }
        const response = await axios(axiosConfig);
        return response.data;
    } catch (error) {
        console.error(`WAHA API Error [${method} ${url}]:`, error.response?.data || error.message);
        throw {
            status: error.response?.status || 500,
            data: error.response?.data || { error: error.message },
            message: error.message
        };
    }
};

// Helper to emit session update event via Socket.io
const emitSessionUpdate = (req) => {
    const io = req.app.get('io');
    if (io) {
        io.emit('sessions:update');
    }
};

// --- Sessions Routes ---

// List all sessions
router.get('/sessions', async (req, res) => {
    try {
        const data = await createWahaRequest('GET', '/api/sessions?all=true');
        res.json(data);
    } catch (error) {
        console.error('Error fetching sessions:', error.message);
        res.status(error.status).json(error.data);
    }
});

// Create a session
router.post('/sessions', async (req, res) => {
    try {
        const data = await createWahaRequest('POST', '/api/sessions', req.body);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error('Error creating session:', error.message);
        res.status(error.status).json(error.data);
    }
});

// Get session information
router.get('/sessions/:session', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('GET', `/api/sessions/${session}`);
        res.json(data);
    } catch (error) {
        console.error(`Error fetching session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Update a session
router.put('/sessions/:session', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('PUT', `/api/sessions/${session}`, req.body);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error updating session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Delete a session
router.delete('/sessions/:session', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('DELETE', `/api/sessions/${session}`);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error deleting session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Get authenticated account info
router.get('/sessions/:session/me', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('GET', `/api/sessions/${session}/me`);
        res.json(data);
    } catch (error) {
        console.error(`Error fetching me info for ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Start session
router.post('/sessions/:session/start', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('POST', `/api/sessions/${session}/start`);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error starting session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Stop session
router.post('/sessions/:session/stop', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('POST', `/api/sessions/${session}/stop`);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error stopping session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Logout session
router.post('/sessions/:session/logout', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('POST', `/api/sessions/${session}/logout`);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error logging out session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Restart session
router.post('/sessions/:session/restart', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('POST', `/api/sessions/${session}/restart`);
        emitSessionUpdate(req);
        res.json(data);
    } catch (error) {
        console.error(`Error restarting session ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// --- Auth/QR Routes ---

// Get QR code for session auth
router.get('/sessions/:session/auth/qr', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('GET', `/api/${session}/auth/qr`);
        res.json(data);
    } catch (error) {
        console.error(`Error getting QR for ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Request auth code
router.post('/sessions/:session/auth/request-code', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('POST', `/api/${session}/auth/request-code`, req.body);
        res.json(data);
    } catch (error) {
        console.error(`Error requesting auth code for ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

// Get screenshot (for QR display)
router.get('/screenshot', async (req, res) => {
    try {
        const data = await createWahaRequest('GET', '/api/screenshot');
        res.json(data);
    } catch (error) {
        console.error('Error getting screenshot:', error.message);
        res.status(error.status).json(error.data);
    }
});

// Subscribe to Presence (typing/online)
router.post('/sessions/:session/presence/:chatId/subscribe', async (req, res) => {
    try {
        const { session, chatId } = req.params;
        // Correct WAHA endpoint: POST /api/{session}/presence/{chatId}/subscribe
        const data = await createWahaRequest('POST', `/api/${session}/presence/${chatId}/subscribe`);
        res.json(data);
    } catch (error) {
        console.error(`Error subscribing presence for ${req.params.chatId}:`, error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

// Get session-specific screenshot
router.get('/sessions/:session/screenshot', async (req, res) => {
    try {
        const { session } = req.params;
        const data = await createWahaRequest('GET', `/api/screenshot?session=${session}`);
        res.json(data);
    } catch (error) {
        console.error(`Error getting screenshot for ${req.params.session}:`, error.message);
        res.status(error.status).json(error.data);
    }
});

const { PhoneNumberUtil, PhoneNumberFormat } = require('google-libphonenumber');
const phoneUtil = PhoneNumberUtil.getInstance();

// Format phone number helper
const formatPhoneNumber = (rawNumber) => {
    try {
        if (!rawNumber) return rawNumber;
        // Check if Brazil (starts with 55) and length
        if (rawNumber.startsWith('55') && rawNumber.length > 10) {
            // const number = phoneUtil.parse('+' + rawNumber);
            // return phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
            const countryCode = rawNumber.substring(0, 2);
            const ddd = rawNumber.substring(2, 4);
            const number = rawNumber.substring(4);

            // Simple formatting +55 18 99823-2124
            if (number.length === 9) {
                return `+${countryCode} ${ddd} ${number.substring(0, 5)}-${number.substring(5)}`;
            }
            if (number.length === 8) {
                return `+${countryCode} ${ddd} ${number.substring(0, 4)}-${number.substring(4)}`;
            }
        }
        return '+' + rawNumber;
    } catch (e) {
        return '+' + rawNumber;
    }
};

// --- Message Sending Routes ---

// Helper to sanitize chatId (remove device part, e.g., :46)
const cleanJid = (jid) => {
    if (!jid) return jid;
    let clean = jid.replace(/:\d+@/, '@');
    clean = clean.replace('@c.us', '@s.whatsapp.net');
    return clean;
};

router.post('/sendText', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.chatId) payload.chatId = cleanJid(payload.chatId);

        const data = await createWahaRequest('POST', '/api/sendText', payload);

        res.json(data);
    } catch (error) {
        console.error('Error sending text:', error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

router.post('/sendImage', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.chatId) payload.chatId = cleanJid(payload.chatId);

        const data = await createWahaRequest('POST', '/api/sendImage', payload);
        res.json(data);
    } catch (error) {
        console.error('Error sending image:', error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

router.post('/sendFile', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.chatId) payload.chatId = cleanJid(payload.chatId);

        const data = await createWahaRequest('POST', '/api/sendFile', payload);
        res.json(data);
    } catch (error) {
        console.error('Error sending file:', error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

router.post('/sendVoice', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.chatId) payload.chatId = cleanJid(payload.chatId);

        const data = await createWahaRequest('POST', '/api/sendVoice', payload);
        res.json(data);
    } catch (error) {
        console.error('Error sending voice:', error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

router.post('/sendVideo', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.chatId) payload.chatId = cleanJid(payload.chatId);

        const data = await createWahaRequest('POST', '/api/sendVideo', payload);
        res.json(data);
    } catch (error) {
        console.error('Error sending video:', error.message);
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

module.exports = router;

