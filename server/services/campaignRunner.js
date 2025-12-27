const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { generateResponse } = require('./geminiService');
const { PhoneNumberUtil, PhoneNumberFormat } = require('google-libphonenumber');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const phoneUtil = PhoneNumberUtil.getInstance();

// Rate limit cache for presence triggers
const presenceCooldowns = new Map();

// Helper for delay
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper to normalize phone
const formatForDB = (rawJid) => {
    try {
        let clean = rawJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        if (!clean.startsWith('+')) clean = '+' + clean;
        const number = phoneUtil.parseAndKeepRawInput(clean);
        return phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL); // +55 18 99123-4567
    } catch (e) {
        return null; // Return null if invalid
    }
};

const SYSTEM_PROMPT_TEMPLATE = `
Você é um SDR (Sales Development Representative) experiente.
Seu objetivo é iniciar uma conversa amigável e persuasiva para vender o seguinte produto/serviço:

Produto: {{product_name}}
Tipo: {{offer_type}}
Preço: {{price}}
Objetivo da Campanha: {{goal}}
Pontos Fortes: {{selling_points}}

Contexto do Lead:
Nome: {{lead_name}}
Origem: {{source}}

INSTRUÇÕES:
1. Seja breve e direto. Sem "Espero que esteja bem".
2. Use o primeiro nome do lead se disponível.
3. Termine com uma pergunta aberta para engajar.
4. Tente conectar a necessidade do lead (baseado na origem/tipo) com o produto.
`;

const getWahaUrl = async () => {
    const { data: settings } = await supabase
        .from('system_settings')
        .select('waha_url, api_key')
        .limit(1)
        .single();

    return {
        url: settings?.waha_url || 'http://localhost:3000',
        key: settings?.api_key || ''
    };
};

const sendWahaMessage = async (sessionName, chatId, text) => {
    const config = await getWahaUrl();
    const url = `${config.url}/api/sendText`;

    try {
        const response = await axios.post(url, {
            session: sessionName,
            chatId: chatId,
            text: text
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': config.key
            }
        });
        return response.data; // Return full data (including id)
    } catch (error) {
        // console.error(`[Waha] Failed to send to ${chatId}:`, error.message);
        return null; // Return null on failure
    }
};

const processSingleLead = async (lead, campaign) => {
    try {
        console.log(`[Runner] Processing Lead: ${lead.name} (${lead.phone}) for Campaign: ${campaign.name}`);

        // 1. Resolve Chat & History
        let history = [];
        let chatId = lead.phone.replace(/\D/g, '');
        if (chatId.length >= 10 && chatId.length <= 11) chatId = '55' + chatId;
        if (!chatId.endsWith('@s.whatsapp.net')) chatId += '@s.whatsapp.net';

        // Find existing chat in DB to load history
        const { data: chat } = await supabase
            .from('chats')
            .select('id')
            .eq('chat_id', chatId)
            .single();

        let chatUUID = chat?.id;

        if (chat) {
            // Fetch last 10 messages from DB
            const { data: msgs } = await supabase
                .from('messages')
                .select('from_me, body, timestamp')
                .eq('chat_id', chat.id)
                .order('timestamp', { ascending: false }) // Get recent first
                .limit(10);

            if (msgs && msgs.length > 0) {
                // Reverse to chronological order (oldest -> newest)
                history = msgs.reverse().map(m => ({
                    role: m.from_me ? 'assistant' : 'user',
                    content: m.body
                }));
                console.log(`[Runner] Loaded ${history.length} msg history for ${lead.name}`);
            }
        }

        // 2. Prepare AI SYSTEM PROMPT
        const offer = campaign.offer_context || {};
        let systemPrompt = SYSTEM_PROMPT_TEMPLATE
            .replace('{{product_name}}', offer.product || 'Produto')
            .replace('{{offer_type}}', offer.type || 'Serviço')
            .replace('{{price}}', offer.price || 'Sob consulta')
            .replace('{{goal}}', offer.goal || 'Agendar Reunião')
            .replace('{{selling_points}}', (offer.selling_points || []).join(', '))
            .replace('{{lead_name}}', lead.name || 'Cliente')
            .replace('{{source}}', lead.custom_fields?.source || 'Desconhecido');

        const agentName = campaign.agents?.name || 'Assistente Virtual';
        if (campaign.agents?.system_prompt) {
            systemPrompt += `\n\nPersona do Agente:\n${campaign.agents.system_prompt}`;
        }

        // CHECK: If last message was from US (assistant), wait for user response or timeout
        if (history.length > 0) {
            const lastMsg = history[history.length - 1];

            // If the last message was ours, we should generally WAIT for the user.
            if (lastMsg.role === 'assistant') {

                // Calculate time since last interaction (using DB timestamp if available, but for now we rely on history order)
                // Ideally checking `lead.last_interaction` is better.
                const lastInteraction = new Date(lead.last_interaction || 0);
                const now = new Date();
                const hoursSinceLast = (now - lastInteraction) / (1000 * 60 * 60);

                // Allow follow-up ONLY if X hours have passed (e.g., 24h)
                // For testing/demo, maybe less, but for "Human" feel, 24h is good.
                // UNLESS it's a "Sniper" (Online) trigger which forces interaction.
                const isSniper = campaign.settings?.trigger_type === 'online';

                if (!isSniper && hoursSinceLast < 24) {
                    console.log(`[Runner] Waiting for user reply. Last sent ${hoursSinceLast.toFixed(1)}h ago. Skipping.`);
                    return;
                }
            }
        }

        // 3. Determine Trigger Prompt (The "User" input to the AI)
        let triggerMessage = '';
        if (history.length === 0) {
            triggerMessage = `Gere a primeira mensagem de abordagem para o lead ${lead.name}. Seja breve e natural.`;
        } else {
            // Contextual Prompting
            triggerMessage = `ANALISE O HISTÓRICO:
             - A última mensagem foi sua (assistant) ou do cliente (user)?
             - Se foi do CLIENTE: Responda a dúvida ou objeção dele.
             - Se foi SUA (assistant) e faz muito tempo: Mande um follow-up curto ("Só para não esquecer...").
             - Se a conversa acabou: Encerre.
             IMPORTANTE: Não seja repetitivo.aja como um humano esperando resposta.`;
        }

        history.push({ role: 'user', content: triggerMessage });

        // 4. Generate AI Response
        // 4. Generate AI Response
        let aiResponse;
        try {
            aiResponse = await generateResponse(
                campaign.agents?.model || 'gemini-1.5-flash',
                history,
                systemPrompt
            );
        } catch (genErr) {
            if (genErr.status === 429 || genErr.message?.includes('429')) {
                console.warn(`[Runner] Rate limit hit for ${lead.phone}. Pausing lead for later.`);
                return; // Exit without failing, will retry next cycle
            }
            throw genErr;
        }

        // Parse Output: It should be { messages: [...] } from geminiService
        const messagesToSend = aiResponse.messages || [];

        // Fallback if messages array is empty but raw response exists
        if (messagesToSend.length === 0 && aiResponse.response) {
            messagesToSend.push(aiResponse.response);
        }

        // --- CRM Actions Logic ---
        let finalStatus = 'contacted'; // Default
        const actions = aiResponse.crm_actions || [];

        if (actions.some(a => a.includes('QUALIFIED'))) finalStatus = 'qualified';
        else if (actions.some(a => a.includes('LOST'))) finalStatus = 'lost';
        else if (actions.some(a => a.includes('JUNK'))) finalStatus = 'junk';
        else if (actions.some(a => a.includes('CONVERTED'))) finalStatus = 'converted';

        console.log(`[Runner] AI Plan: ${JSON.stringify(aiResponse.thought)}`);
        console.log(`[Runner] CRM Action: ${finalStatus.toUpperCase()}`);

        if (messagesToSend.length === 0 && finalStatus === 'contacted') {
            // If no message and no status change, do nothing (maybe it thinks it's waiting)
            console.log('[Runner] No messages to send. Skipping.');
            return;
        }

        console.log(`[Runner] Sending ${messagesToSend.length} bubbles...`);

        let allSent = true;

        for (const msgText of messagesToSend) {
            if (!msgText || msgText.trim() === '') continue;

            // 🚨 SAFETY CHECK (RACE CONDITION) 🚨
            const { data: freshLead } = await supabase
                .from('campaign_leads')
                .select('status')
                .eq('id', lead.id)
                .single();

            if (freshLead && freshLead.status === 'manual_intervention') {
                console.warn(`[Runner] 🛑 ABORTING: User took control of ${lead.name}`);
                return;
            }

            const sentData = await sendWahaMessage(campaign.session_name, chatId, msgText);

            if (sentData && sentData.id) {
                // ✅ SUCCEESS: Save author to DB immediately
                if (chatUUID) {

                    // Wait a tiny bit for the webhook to create the message first? 
                    // Or insert it ourselves if we want to be sure about the author?
                    // Webhook handles insertion usually. We can UPDATE recent message or UPSERT.
                    // Better to UPSERT here to ensure 'author' is set.

                    await supabase.from('messages').upsert({
                        message_id: sentData.id,
                        chat_id: chatUUID,
                        body: msgText,
                        from_me: true,
                        // type: 'text', // Optional, webhook handles it
                        timestamp: new Date().toISOString(),
                        author: agentName // 🏷️ AI ATTRIBUTION
                    }, { onConflict: 'message_id' });

                    console.log(`[Runner] 🏷️ Tagged message ${sentData.id} as ${agentName}`);
                }

            } else {
                allSent = false;
            }

            // Artificial typing delay based on length
            await sleep(Math.min(1000 + msgText.length * 30, 4000));
        }

        if (allSent) {
            // Update Lead Status
            const { data: updateData, error: updateError } = await supabase
                .from('campaign_leads')
                .update({
                    status: finalStatus,
                    last_interaction: new Date().toISOString()
                })
                .eq('id', lead.id)
                .select(); // Return data to verify

            if (updateError) {
                console.error(`[Runner] ❌ Failed to update status for ${lead.name}:`, updateError.message);
            } else {
                console.log(`[Runner] ✅ Sequence complete for ${lead.name}. Status: ${finalStatus}`, updateData);
            }
        } else {
            await supabase
                .from('campaign_leads')
                .update({ status: 'failed' })
                .eq('id', lead.id);
            console.error(`[Runner] Failed to complete sequence for ${lead.phone}`);
        }

    } catch (err) {
        console.error(`[Runner] Error processing lead ${lead.id}:`, err);
    }
};

const processCampaigns = async () => {
    // 1. Fetch Active Campaigns
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
            *,
            agents (
                 name,
                 model,
                 system_prompt
            )
        `)
        .eq('status', 'active');

    if (error || !campaigns || campaigns.length === 0) return;

    // Filter out Online Trigger campaigns (they are handled by the presence listener)
    const intervalCampaigns = campaigns.filter(c => c.settings?.trigger_type !== 'online');

    for (const campaign of intervalCampaigns) {
        // Check Schedule/Time settings
        const settings = campaign.settings || {};

        if (settings.daily_start && settings.daily_end) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();

            const [startHour, startMinute] = settings.daily_start.split(':').map(Number);
            const startTime = startHour * 60 + startMinute;

            const [endHour, endMinute] = settings.daily_end.split(':').map(Number);
            const endTime = endHour * 60 + endMinute;

            if (currentTime < startTime || currentTime > endTime) {
                // console.log(`[Runner] Campaign ${campaign.name} outside active hours. Skipping.`);
                continue;
            }
        }

        // 2. Fetch Active Leads (Pending or In Progress)
        // Strictly EXCLUDE terminal states: lost, junk, converted, qualified, failed
        const { data: leads } = await supabase
            .from('campaign_leads')
            .select('*')
            .eq('campaign_id', campaign.id)
            .in('status', ['pending', 'contacted', 'responded', 'negotiating'])
            .order('last_interaction', { ascending: true, nullsFirst: true }) // Fair rotation
            .limit(1);

        if (!leads || leads.length === 0) continue;

        const lead = leads[0];
        console.log(`[Runner] Targeting Lead (Interval Mode): ${lead.name} (${lead.phone})`);

        await processSingleLead(lead, campaign);
    }
};

const handlePresenceTrigger = async (chatId, status) => {
    // Only care about online
    if (status !== 'online' && status !== 'recording' && status !== 'composing') return;

    // Normalize phone from chatId
    const dbPhone = formatForDB(chatId);
    if (!dbPhone) return;

    // Safety Cooldown
    if (presenceCooldowns.has(chatId)) {
        const lastTime = presenceCooldowns.get(chatId);
        if (Date.now() - lastTime < 300000) { // 5 minutes cooldown
            return;
        }
    }

    try {
        // Find Active "Sniper" Campaigns
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select(`
                *,
                agents (name, model, system_prompt)
            `)
            .eq('status', 'active');

        if (!campaigns || campaigns.length === 0) return;

        const sniperCampaigns = campaigns.filter(c => c.settings?.trigger_type === 'online');
        if (sniperCampaigns.length === 0) return;

        // For each sniper campaign, check if this user is a pending lead
        for (const campaign of sniperCampaigns) {
            // Check Daily Schedule first
            const settings = campaign.settings || {};
            if (settings.daily_start && settings.daily_end) {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const [startHour, startMinute] = settings.daily_start.split(':').map(Number);
                const startTime = startHour * 60 + startMinute;
                const [endHour, endMinute] = settings.daily_end.split(':').map(Number);
                const endTime = endHour * 60 + endMinute;

                if (currentTime < startTime || currentTime > endTime) continue;
            }

            // DB Search for EXACT formatted phone
            const { data: leads } = await supabase
                .from('campaign_leads')
                .select('*')
                .eq('campaign_id', campaign.id)
                .eq('status', 'pending')
                .eq('phone', dbPhone) // Exact match on formatted phone
                .limit(1);

            if (leads && leads.length > 0) {
                const lead = leads[0];
                console.log(`[Sniper] Target Spotted: ${lead.name} (${dbPhone}) is ONLINE. Firing! 🎯`);

                presenceCooldowns.set(chatId, Date.now());
                await processSingleLead(lead, campaign);
                return; // Fire once per presence event
            }
        }

    } catch (err) {
        console.error('[Sniper] Error checking trigger:', err);
    }
};

const startRunner = () => {
    console.log('[Campaign Runner] Service Started (Interval: 30s)');
    // Run every 30 seconds
    setInterval(processCampaigns, 30000);
};

module.exports = { startRunner, handlePresenceTrigger };
