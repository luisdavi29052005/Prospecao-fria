const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for fetching system settings
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let genAI = null;

/**
 * Fetches the Gemini API Key from the system_settings table.
 * Assumes a table structure where keys are stored, e.g., key_name='gemini_api_key', value='XYZ'.
 */
async function getGeminiApiKey() {
    try {
        // Fetch the first available system settings row
        const { data, error } = await supabase
            .from('system_settings')
            .select('gemini_key')
            .limit(1)
            .single();

        if (error) {
            console.error("Error fetching Gemini API Key from Supabase:", error);
            return null;
        }

        return data?.gemini_key;
    } catch (err) {
        console.error("Unexpected error retrieving API key:", err);
        return null;
    }
}

/**
 * Initializes the Google Generative AI client if not already initialized.
 */
async function initializeGemini() {
    if (genAI) return genAI;

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Gemini API Key not found in system_settings.");
    }

    genAI = new GoogleGenerativeAI(apiKey);
    console.log("✨ Gemini AI Initialized successfully.");
    return genAI;
}

/**
 * Generates content using a specific model.
 * @param {string} modelName - e.g., 'gemini-2.0-flash'
 * @param {string} prompt - The user prompt
 * @param {string} systemInstruction - Optional system instruction
 * @returns {Promise<string>} - The generated text
 */
const SYSTEM_CORE_INSTRUCTION = `
Você é um agente de vendas avançado.
Você DEVE responder com um objeto JSON usando esta estrutura:
{
  "thought": "Seu raciocínio em Português sobre o estado do lead e estratégia.",
  "messages": ["Mensagem 1", "Mensagem 2 (opcional)"],
  "crm_actions": []
}

REGRA PARA 'crm_actions':
- Se o lead demonstrar interesse claro ou pedir agendamento -> ["QUALIFIED"]
- Se o lead disser explicitamente "não tenho interesse", "pare de mandar msg", ou for agressivo -> ["LOST"]
- Se o número for errado ou lead inválido -> ["JUNK"]
- Se o lead aceitou a oferta/comprou -> ["CONVERTED"]
- Caso contrário, mantenha vazio [].

IMPORTANTE:
- "messages": Array de strings curtas (máx 200 caracteres cada). Divida o pensamento em 2 ou 3 balões se necessário.
- Retorne APENAS JSON válido.
`;

async function generateResponse(modelName, history, userSystemPrompt) {
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
        throw new Error("Gemini API Key not found in system_settings.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Combine Core Rules with User Personality
    const combinedSystemPrompt = `${SYSTEM_CORE_INSTRUCTION}\n\nUSER PERSONA:\n${userSystemPrompt || ''}`;

    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: combinedSystemPrompt,
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    try {
        // Convert history to Gemini format if needed (Role mapping)
        // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
        // Incoming history might be: [{ role: "user", content: "..." }]
        const chatHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // The last message in 'history' is technically the new prompt.
        const lastMessage = chatHistory.pop();
        if (!lastMessage || !lastMessage.parts[0].text) {
            throw new Error("History must contain at least one message.");
        }

        // VALIDATION: Ensure history starts with 'user' if it's not empty
        // Gemini throws "First content should be with role 'user', got model" if it's wrong.
        if (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
            chatHistory.unshift({
                role: 'user',
                parts: [{ text: "Contexto inicial da conversa." }]
            });
        }

        const chat = model.startChat({
            history: chatHistory
        });

        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const responseText = result.response.text();

        // Try parsing JSON
        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse JSON response:", responseText);
            // Fallback object
            return {
                thought: "Failed to parse JSON",
                messages: [responseText],
                crm_actions: []
            };
        }

    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        throw error;
    }
}

module.exports = {
    generateResponse
};
