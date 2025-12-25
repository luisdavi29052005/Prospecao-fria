const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

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

const createWahaMultipartRequest = async (method, endpoint, formData, headers = {}) => {
    const config = await getWahaConfig();
    let baseUrl = config.baseUrl.replace(/\/$/, '');

    // Logic: Ensure we have ONE /api prefix in the final URL
    let cleanEndpoint = endpoint;
    if (!endpoint.startsWith('/')) cleanEndpoint = '/' + endpoint;

    if (baseUrl.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
        cleanEndpoint = cleanEndpoint.substring(4);
    } else if (!baseUrl.endsWith('/api') && !cleanEndpoint.startsWith('/api')) {
        cleanEndpoint = '/api' + cleanEndpoint;
    }

    const url = `${baseUrl}${cleanEndpoint}`;
    console.log(`🌐 WAHA Multipart: ${method} ${url}`);

    const finalHeaders = {
        ...headers,
        'accept': 'application/json'
    };

    if (config.apiKey) {
        finalHeaders['X-Api-Key'] = config.apiKey;
    }

    // Calculate length for Content-Length header
    const getLength = (formData) => new Promise((resolve, reject) => {
        formData.getLength((err, length) => {
            if (err) reject(err);
            else resolve(length);
        });
    });

    let contentLength = 0;
    try {
        contentLength = await getLength(formData);
    } catch (e) {
        console.warn('⚠️ Could not calculate form data length:', e.message);
    }

    const multipartHeaders = formData.getHeaders();
    if (contentLength > 0) {
        multipartHeaders['Content-Length'] = contentLength;
    }

    try {
        const response = await axios({
            method,
            url,
            data: formData,
            headers: {
                ...finalHeaders,
                ...multipartHeaders
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            responseType: 'arraybuffer' // We expect a file back
        });
        return response;
    } catch (error) {
        let errorData = error.response?.data;
        if (errorData instanceof ArrayBuffer) {
            // Convert ArrayBuffer back to string if it's an error message
            errorData = Buffer.from(errorData).toString();
            try { errorData = JSON.parse(errorData); } catch (e) { }
        }

        console.error(`WAHA Multi-part Error [${method} ${url}]:`, errorData || error.message);
        throw {
            status: error.response?.status || 500,
            data: errorData || { error: error.message },
            message: error.message
        };
    }
};

// Create axios request helper
const createWahaRequest = async (method, endpoint, data = null) => {
    const config = await getWahaConfig();
    let baseUrl = config.baseUrl.replace(/\/$/, '');

    // Logic: Ensure we have ONE /api prefix in the final URL
    let cleanEndpoint = endpoint;
    if (!endpoint.startsWith('/')) cleanEndpoint = '/' + endpoint;

    if (baseUrl.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
        cleanEndpoint = cleanEndpoint.substring(4);
    } else if (!baseUrl.endsWith('/api') && !cleanEndpoint.startsWith('/api')) {
        cleanEndpoint = '/api' + cleanEndpoint;
    }

    const url = `${baseUrl}${cleanEndpoint}`;
    console.log(`🌐 WAHA Request: ${method} ${url}`);

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

// --- Config Route ---
router.get('/config', async (req, res) => {
    try {
        const config = await getWahaConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

const multer = require('multer');
const upload = multer();
const FormData = require('form-data');

router.post('/:session/media/convert/voice', upload.single('file'), async (req, res) => {
    let inputPath = null;
    let outputPath = null;

    try {
        const { session } = req.params;
        const file = req.file;
        console.log(`🎙️ Local Conversion Request: Session=${session}, File=${file?.originalname} (${file?.size} bytes) Mime=${file?.mimetype}`);

        if (!file) {
            console.error('❌ No file in conversion request');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create temporary file paths
        const tempDir = os.tmpdir();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        inputPath = path.join(tempDir, `input-${uniqueSuffix}.webm`);
        outputPath = path.join(tempDir, `output-${uniqueSuffix}.ogg`);

        // Write buffer to temp file
        await fs.promises.writeFile(inputPath, file.buffer);

        console.log(`🔄 Converting locally: ${inputPath} -> ${outputPath}`);

        // Perform conversion using fluent-ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('ogg')
                .audioCodec('libopus')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(outputPath);
        });

        // Read the converted file
        const convertedBuffer = await fs.promises.readFile(outputPath);

        console.log(`✅ Local voice conversion successful (${convertedBuffer.length} bytes)`);

        res.setHeader('Content-Type', 'audio/ogg; codecs=opus');
        res.send(convertedBuffer);

    } catch (error) {
        console.error('❌ Error converting voice locally:', error.message);
        console.error(error);
        res.status(500).json({ error: 'Local conversion failed: ' + error.message });
    } finally {
        // Cleanup temp files
        try {
            if (inputPath && fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
            if (outputPath && fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
        } catch (cleanupErr) {
            console.warn('⚠️ Failed to cleanup temp files:', cleanupErr.message);
        }
    }
});

router.post('/:session/media/convert/video', upload.single('file'), async (req, res) => {
    try {
        const { session } = req.params;
        const file = req.file;
        console.log(`🎬 Conversion Request: Session=${session}, File=${file?.originalname} (${file?.size} bytes)`);

        if (!file) {
            console.error('❌ No file in conversion request');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const formData = new FormData();
        // Force filename and content-type
        formData.append('file', file.buffer, {
            filename: 'video_message.mp4',
            contentType: 'video/mp4'
        });

        // Endpoint: createWahaMultipartRequest will handle the /api prefix
        const response = await createWahaMultipartRequest('POST', `/${session}/media/convert/video`, formData);

        console.log(`✅ Video converted successfully (${response.data.length} bytes)`);
        res.setHeader('Content-Type', 'video/mp4');
        res.send(response.data);
    } catch (error) {
        console.error('❌ Error converting video:', error.message);
        if (error.data) {
            console.error('📦 Error details:', typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2));
        }
        res.status(error.status || 500).json(error.data || { error: error.message });
    }
});

module.exports = router;

