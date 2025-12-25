
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const { PhoneNumberUtil, PhoneNumberFormat } = require('google-libphonenumber');
require('dotenv').config();

const normalizeJid = (jid) => {
    if (!jid) return jid;
    // 1. Remove device identifiers (551899...:46@s.whatsapp.net -> 551899...@s.whatsapp.net)
    let clean = jid.replace(/:\d+@/, '@');
    // 2. Normalize domains (@c.us -> @s.whatsapp.net)
    clean = clean.replace('@c.us', '@s.whatsapp.net');
    return clean.toLowerCase().trim();
};

const phoneUtil = PhoneNumberUtil.getInstance();

// In-memory cache for LID -> JID mapping (e.g., 247...@lid -> 551...@s.whatsapp.net)
const lidCache = new Map();

const formatPhoneNumber = (rawPhone) => {
    try {
        if (!rawPhone) return rawPhone;
        // Add + if missing for parsing
        const text = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone;
        const number = phoneUtil.parseAndKeepRawInput(text);
        return phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
    } catch (e) {
        return rawPhone; // Return original if parsing fails
    }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Supabase client - use service key if available, otherwise anon key
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    supabaseKey
);

console.log('🔐 Supabase initialized with:', supabaseKey?.substring(0, 20) + '...');

const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Make io accessible to routes
app.set('io', io);

// Routes
const wahaRoutes = require('./routes/waha');
app.use('/api/waha', wahaRoutes);

app.get('/', (req, res) => {
    res.send('Backend Prospecção Fria is running');
});

// Waha Webhook Endpoint
app.post('/api/webhook/waha', async (req, res) => {
    try {
        const { event, payload, session } = req.body;
        const sessionName = session || 'default';

        console.log(`🔔 Webhook: ${event} | Session: ${sessionName}`);

        // Log FULL payload for ALL events (debug mode)
        console.log('📦 Full Payload:', JSON.stringify(payload, null, 2));

        if (event === 'message' || event === 'message.any') {
            await handleMessageEvent(payload, sessionName);
        } else if (event === 'session.status') {
            console.log(`📱 Session status: ${payload?.status}`);
            io.emit('session.status', { session: sessionName, status: payload?.status });
        } else if (event === 'presence.update' || (event === 'engine.event' && (payload?.event === 'events.Presence' || payload?.event === 'events.ChatPresence'))) {
            // Support both standard presence.update and engine.event (Presence/ChatPresence)
            let rawId = payload.id || payload.data?.From || payload.data?.Chat;
            let status = payload.presence || payload.presences?.[0]?.lastKnownPresence || payload.data?.State;

            // Handle engine.event specific structure
            if (event === 'engine.event') {
                if (payload?.event === 'events.Presence') {
                    status = payload.data?.Unavailable === false ? 'online' : 'offline';
                }
                // State is handled above for ChatPresence
            }

            // Standardize: 'paused' means they stopped typing but are still online
            if (status === 'paused') status = 'online';

            if (!rawId) return res.status(200).send({ status: 'ignored_no_id' });

            let resolvedId = rawId;
            if (resolvedId.includes('@lid') && lidCache.has(resolvedId)) {
                resolvedId = lidCache.get(resolvedId);
            }

            // NORMALIZE BEFORE EMITTING
            const finalId = normalizeJid(resolvedId);
            const originalNormalized = normalizeJid(rawId);

            console.log(`👤 Presence (${event}/${payload?.event || ''}): ${rawId} -> ${finalId} [${status}]`);
            io.emit('presence.update', {
                session: sessionName,
                chatId: finalId,
                originalId: originalNormalized,
                status: status
            });
        }

        res.status(200).send({ status: 'received' });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).send({ error: error.message });
    }
});

// Handle incoming message and save to Supabase
async function handleMessageEvent(payload, sessionName) {
    const {
        id: messageId,
        from,
        to,
        body,
        fromMe,
        timestamp,
        type,
        _data
    } = payload;

    // Strict fromMe determination based on Waha ID prefix (true_... / false_...)
    let isFromMe = fromMe;
    if (typeof messageId === 'string') {
        if (messageId.startsWith('true_')) isFromMe = true;
        else if (messageId.startsWith('false_')) isFromMe = false;
    }

    let chatId = isFromMe ? to : from; // Default logic

    // Fix for SENT messages (message.any)
    if (isFromMe) {
        // If 'to' is null or an LID, try to find the real recipient JID
        const recipientAlt = _data?.Info?.RecipientAlt;
        const destinationJid = _data?.Info?.DeviceSentMeta?.DestinationJID;
        const infoChat = _data?.Info?.Chat; // <--- The correct chat ID often lives here

        if (recipientAlt) {
            chatId = recipientAlt;
        } else if (destinationJid) {
            chatId = destinationJid;
        } else if (infoChat) {
            chatId = infoChat;
        }

        console.log('📤 Processing SENT message. Resolved ChatID:', chatId);
    }

    // Fallback: If still null or using c.us, try Info.Chat for any message type
    if (!chatId && _data?.Info?.Chat) {
        chatId = _data.Info.Chat;
    }

    // Fix: If chatId is an LID (Linked Device ID) and we haven't resolved it yet
    if (chatId?.includes('@lid')) {
        const senderAlt = _data?.Info?.SenderAlt; // e.g., "5518998232124:46@s.whatsapp.net"
        if (senderAlt) {
            console.log('🔄 Converting LID to JID (SenderAlt):', chatId, '->', senderAlt);
            // Cache the mapping for presence updates
            lidCache.set(chatId, senderAlt.replace(/:\d+@/, '@'));
            chatId = senderAlt;
        } else if (lidCache.has(chatId)) {
            // Fix: Use cached JID if available
            const cachedJid = lidCache.get(chatId);
            console.log('🔄 Using cached JID for LID:', chatId, '->', cachedJid);
            chatId = cachedJid;
        } else if (_data?.id?.remote) {
            // Fallback to remote if SenderAlt is missing
            chatId = _data.id.remote;
        }
    }

    // Force Clean chatId (remove device identifiers like :46)
    // Converts "5518998232124:46@s.whatsapp.net" -> "5518998232124@s.whatsapp.net"
    if (chatId) {
        chatId = chatId.replace(/:\d+@/, '@');
        // Normalize domain: @c.us -> @s.whatsapp.net
        chatId = chatId.replace('@c.us', '@s.whatsapp.net');
    } else {
        console.log('⚠️ Could not resolve Chat ID. Skipping message processing.');
        return;
    }

    const pushName = _data?.notifyName || _data?.Info?.PushName || null;

    // Extract phone number: Aggressively clean suffixes (e.g., :46@s.whatsapp.net)
    let phone = chatId ? chatId.split('@')[0].split(':')[0] : null;

    if (phone) {
        phone = formatPhoneNumber(phone);
    }

    const isGroup = chatId?.includes('@g.us') || false;

    console.log(`📩 ${isFromMe ? '➡️ Enviada' : '⬅️ Recebida'}: "${body?.substring(0, 50)}..." | De: ${pushName} (${phone})`);

    // Get user_id from system_settings (first user for now)
    // In production, you'd match by session/WAHA config
    const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('user_id')
        .limit(1)
        .single();

    if (settingsError) {
        console.log('⚠️ Settings query error:', settingsError.message);
    }

    if (!settings?.user_id) {
        console.log('⚠️ No user found in settings, data:', settings);
        return;
    }

    const userId = settings.user_id;

    // Upsert chat (create or update)
    const { data: chat, error: chatError } = await supabase
        .from('chats')
        .upsert({
            user_id: userId,
            session_name: sessionName,
            chat_id: chatId,
            name: pushName,
            phone: phone,
            is_group: isGroup,
            last_message: body?.substring(0, 200),
            last_message_at: new Date(timestamp * 1000).toISOString(),
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,session_name,chat_id'
        })
        .select()
        .single();

    if (chatError) {
        console.error('Chat upsert error:', chatError.message);
        return;
    }

    console.log(`💬 Chat: ${chat.id} | ${chat.name || chat.phone}`);

    // Verify if message already exists (Idempotency)
    const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('message_id', messageId)
        .single();

    if (existingMessage) {
        console.log(`⚠️ Message ${messageId} already exists. Skipping.`);
        // Emit via socket anyway to ensure UI is up to date (e.g. status change)
        io.emit('message', {
            chatId: chat.id,
            sessionName,
            message: {
                id: existingMessage.id,
                message_id: messageId,
                body,
                fromMe: isFromMe,
                timestamp: new Date(timestamp * 1000).toISOString(),
                type
            },
            chat: {
                id: chat.id,
                name: chat.name,
                phone: chat.phone,
                isGroup: chat.is_group
            }
        });
        return;
    }

    // Media Handling
    let mediaUrl = null;
    // Infer type if missing (key fix for rendering players)
    let messageType = type;
    if (!messageType && _data?.Info?.MediaType) {
        messageType = _data.Info.MediaType;
    }
    // Also check generic Type if MediaType is missing
    if (!messageType && _data?.Info?.Type === 'media') {
        // Fallback if we can't be specific? Or stick to 'text' until we know.
        // Usually MediaType is present for ptt/image.
    }

    if (!messageType) {
        messageType = 'text';
    }

    console.log(`🔍 Type Inference: Raw=${type}, Inferred=${messageType}, HasMedia=${payload.hasMedia}`);

    if (payload.hasMedia || messageType === 'image' || messageType === 'ptt' || messageType === 'audio' || messageType === 'video' || messageType === 'document') {
        try {
            console.log(`📥 Downloading media for message ${messageId}...`);
            const wahaUrl = process.env.WAHA_API_URL || 'http://localhost:3000';

            // Prioritize URL from payload if available (often resolves ID mismatches)
            let downloadUrl = payload.media?.url;

            // If URL is missing or internal/relative, construct standard API URL
            if (!downloadUrl) {
                downloadUrl = `${wahaUrl}/api/${sessionName}/messages/${messageId}/media`;
            } else if (!downloadUrl.startsWith('http')) {
                // Handle relative URLs if Waha returns them
                downloadUrl = `${wahaUrl}${downloadUrl}`;
            }

            console.log(`🔗 Using media URL: ${downloadUrl}`);

            // Download media
            const response = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                validateStatus: (status) => status < 500 // Don't throw on 404
            });

            if (response.status === 200 && response.data) {
                const buffer = Buffer.from(response.data, 'binary');
                const contentType = response.headers['content-type'] || 'application/octet-stream';

                // Determine extension and update messageType if generic
                let ext = 'bin';
                if (contentType.includes('image/jpeg')) { ext = 'jpg'; messageType = 'image'; }
                else if (contentType.includes('image/png')) { ext = 'png'; messageType = 'image'; }
                else if (contentType.includes('audio/ogg') || contentType.includes('application/ogg')) { ext = 'ogg'; messageType = 'ptt'; }
                else if (contentType.includes('audio/mpeg')) { ext = 'mp3'; messageType = 'audio'; }
                else if (contentType.includes('audio/webm')) { ext = 'webm'; messageType = 'ptt'; }
                else if (contentType.includes('video/mp4')) { ext = 'mp4'; messageType = 'video'; }
                else if (contentType.includes('application/pdf')) { ext = 'pdf'; messageType = 'document'; }

                const filename = `${messageId}.${ext}`;
                const storagePath = `${sessionName}/${chatId}/${filename}`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(storagePath, buffer, {
                        contentType: contentType,
                        upsert: true
                    });

                if (uploadError) {
                    console.error('⚠️ Storage upload error:', uploadError.message);
                } else {
                    // Get Public URL
                    const { data: publicUrlData } = supabase.storage
                        .from('chat-media')
                        .getPublicUrl(storagePath);

                    mediaUrl = publicUrlData.publicUrl;
                    console.log(`✅ Media uploaded: ${mediaUrl}`);
                }
            } else {
                console.warn(`⚠️ Failed to download media. Status: ${response.status}`);
            }
        } catch (err) {
            console.error('❌ Failed to process media:', err.message);
        }
    }

    // Insert message (updated with media_url)
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
            chat_id: chat.id,
            user_id: userId,
            message_id: messageId,
            from_me: Boolean(isFromMe),
            body: body || (mediaUrl ? (type === 'ptt' ? 'Áudio' : 'Mídia') : ''), // Fallback body for media
            type: messageType,
            media_url: mediaUrl,
            timestamp: new Date(timestamp * 1000).toISOString()
        })
        .select()
        .single();

    if (msgError) {
        console.error('Message insert error:', msgError.message);
        return;
    }

    console.log(`💾 Message saved: ${message.id}`);

    // Emit to connected clients via Socket.io
    io.emit('message', {
        chatId: chat.id,
        sessionName,
        message: {
            id: message.id,
            message_id: message.message_id,
            body,
            fromMe: isFromMe,
            timestamp: message.timestamp,
            type: messageType,
            mediaUrl: mediaUrl
        },
        chat: {
            id: chat.id,
            name: chat.name,
            phone: chat.phone,
            isGroup: chat.is_group
        }
    });
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Export io for use in routes
module.exports = { io };
