
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import {
    Wifi, WifiOff, RefreshCw, Loader, MessageSquare, Check, Play,
    AlertTriangle, Search, Filter, Paperclip, Plus, Image as ImageIcon,
    FileText, Camera, Mic, Smile, X, LogOut, MoreVertical, SlidersHorizontal, ChevronDown, Trash2
} from 'lucide-react';
import ChatsSkeleton from '../../components/skeletons/ChatsSkeleton';
import MinimalAudioPlayer from '../../components/MinimalAudioPlayer';
import Toast from '../../components/Toast';
import { supabase } from '../../lib/supabaseClient';
import { wahaService } from '../../services/waha';
import { setChatCache, getChatCache, setMessageCache, getMessageCache } from '../../lib/dataCache';

// ----------------------------------------------------------------------------
// UTILS
// ----------------------------------------------------------------------------
const normalizeJid = (jid) => {
    if (!jid) return jid;
    // 1. Remove device identifiers (551899...:46@s.whatsapp.net -> 551899...@s.whatsapp.net)
    let clean = jid.replace(/:\d+@/, '@');
    // 2. Normalize domains (@c.us -> @s.whatsapp.net)
    clean = clean.replace('@c.us', '@s.whatsapp.net');
    return clean.toLowerCase().trim();
};

const getDateLabel = (date) => {
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (messageDate.getTime() === today.getTime()) {
        return 'Hoje';
    } else if (messageDate.getTime() === yesterday.getTime()) {
        return 'Ontem';
    } else {
        return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
};

const formatLastSeen = (dateString) => {
    if (!dateString) return 'Visto por último recentemente';
    const d = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (msgDate.getTime() === today.getTime()) {
        return `Visto por último hoje às ${timeStr}`;
    } else if (msgDate.getTime() === yesterday.getTime()) {
        return `Visto por último ontem às ${timeStr}`;
    } else {
        return `Visto por último em ${d.toLocaleDateString('pt-BR')} às ${timeStr}`;
    }
};

const ChatsPage = () => {
    const { user, logout } = useAuth();
    const fileInputRef = useRef(null);
    const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
    const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
    const [isSessionSelectorOpen, setIsSessionSelectorOpen] = useState(false); // New Custom Selector State
    const [isSearchFocused, setIsSearchFocused] = useState(false); // Search Focus State
    const [attachType, setAttachType] = useState(null); // 'image', 'document', etc.

    // Get session state from parent layout
    const {
        activeSession: parentActiveSession,
        sessions: parentSessions,
        setActiveSession: setParentActiveSession,
        refreshSessions
    } = useOutletContext() || {};

    const activeSession = parentActiveSession;

    // Initialize from cache
    const cachedLeads = activeSession ? getChatCache(activeSession.name) : null;
    const [isLoadingData, setIsLoadingData] = useState(!cachedLeads);
    const [leads, setLeads] = useState(cachedLeads || []);
    const [hasSession, setHasSession] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [selectedLead, setSelectedLead] = useState(() => {
        if (cachedLeads && cachedLeads.length > 0) {
            const lastId = localStorage.getItem('lastSelectedChatId');
            if (lastId) {
                return cachedLeads.find(l => l.id === lastId) || null;
            }
        }
        return null;
    });

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, chatId: null });

    // Toast Notification State
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Delete Chat Handler
    const handleDeleteChat = async () => {
        if (!contextMenu.chatId) return;

        const chatIdToDelete = contextMenu.chatId;
        const previousLeads = [...leads];

        // Optimistic UI update
        setLeads(prev => prev.filter(l => l.id !== chatIdToDelete));
        if (selectedLead?.id === chatIdToDelete) setSelectedLead(null);
        setContextMenu({ show: false, x: 0, y: 0, chatId: null });

        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatIdToDelete);

            if (error) throw error;
            console.log('✅ Chat deleted successfully');
        } catch (err) {
            console.error('Error deleting chat:', err);
            // Revert on error
            setLeads(previousLeads);
            alert('Erro ao excluir chat.');
        }
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu({ show: false, x: 0, y: 0, chatId: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);
    // Auto-refresh while STARTING to catch status change to WORKING
    useEffect(() => {
        let interval;
        if (activeSession && (activeSession.status === 'STARTING')) {
            interval = setInterval(() => {
                refreshSessions();
            }, 2000); // Check every 2s
        }
        return () => clearInterval(interval);
    }, [activeSession?.status, refreshSessions]);

    const [sessionName, setSessionName] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [presence, setPresence] = useState({}); // { chatId: 'composing' | 'recording' | 'available' }
    const [showChatMenu, setShowChatMenu] = useState(false);

    // Checkpoint for auto-scroll
    const messagesEndRef = useRef(null);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);





    const sessions = parentSessions; // Can be null (loading)

    // Save selected lead to localstorage
    useEffect(() => {
        if (selectedLead) {
            localStorage.setItem('lastSelectedChatId', selectedLead.id);
        }
    }, [selectedLead]);



    const handleSendMessage = async () => {
        if (!inputValue.trim() || !selectedLead || !activeSession) return;

        const tempId = 'temp-' + Date.now();
        const textToSend = inputValue.trim();

        // Optimistic UI Update
        const optimisticMsg = {
            id: tempId,
            body: textToSend,
            from_me: true,
            timestamp: new Date().toISOString(),
            chat_id: selectedLead.id,
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInputValue('');

        try {
            const response = await wahaService.sendText({
                session: activeSession.name,
                chatId: selectedLead.chat_id || selectedLead.phone,
                text: textToSend
            });

            if (response && response.id) {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: response.id, message_id: response.id, status: 'sent' } : m));
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert('Erro ao enviar mensagem');
        }
    };

    // --- Audio Recording Logic ---
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Erro ao acessar microfone. Verifique as permissões.');
        }
    };

    const handleStopRecording = async (send = true) => {
        if (!mediaRecorderRef.current) return;

        const recorder = mediaRecorderRef.current;

        return new Promise((resolve) => {
            recorder.onstop = async () => {
                clearInterval(timerRef.current);
                setIsRecording(false);
                setRecordingTime(0);

                // Stop all tracks
                recorder.stream.getTracks().forEach(track => track.stop());

                if (send && audioChunksRef.current.length > 0) {
                    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                        ? 'audio/webm;codecs=opus'
                        : 'audio/ogg;codecs=opus';

                    const extension = mimeType.includes('webm') ? 'webm' : 'ogg';

                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                    const processAndSend = async (blob) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);

                        reader.onloadend = async () => {
                            const base64Data = reader.result.split(',')[1];
                            try {
                                const targetId = selectedLead.chat_id || selectedLead.phone || selectedLead.id;
                                const waMimeType = 'audio/ogg; codecs=opus';

                                await wahaService.sendVoice({
                                    chatId: targetId,
                                    file: {
                                        mimetype: waMimeType,
                                        filename: 'voice_message.ogg',
                                        data: base64Data
                                    },
                                    session: activeSession.name
                                });
                                console.log('Voice message sent!');
                            } catch (err) {
                                console.error('Error sending voice:', err);
                                alert('Erro ao enviar áudio. Verifique o console.');
                            }
                        };
                    };

                    try {
                        console.log('🎬 Converting recorded voice...');
                        const convertedBlob = await wahaService.convertVoice(activeSession.name, audioBlob);
                        await processAndSend(convertedBlob);
                    } catch (convErr) {
                        console.warn('⚠️ Conversion failed, sending original blob:', convErr);
                        await processAndSend(audioBlob);
                    }
                }
                resolve();
            };

            recorder.stop();
        });
    };

    const handleCancelRecording = () => {
        handleStopRecording(false);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleDeleteMessages = async () => {
        if (!selectedLead || !activeSession) return;

        const confirmDelete = window.confirm("Deseja realmente apagar TODAS as mensagens desta conversa?");
        if (!confirmDelete) return;

        try {
            // Use selectedLead.id which is the UUID in the messages.chat_id column
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('chat_id', selectedLead.id);

            if (error) {
                console.error('Error deleting messages:', error.message);
                alert('Erro ao apagar mensagens: ' + error.message);
            } else {
                setMessages([]);
                setShowChatMenu(false);
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedLead || !activeSession) return;

        try {
            let fileToUpload = file;
            let finalType = file.type;

            // Media Conversion for Audio/Video
            if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                console.log(`🎬 Converting ${file.type}...`);
                try {
                    const convertedBlob = file.type.startsWith('audio/')
                        ? await wahaService.convertVoice(activeSession.name, file)
                        : await wahaService.convertVideo(activeSession.name, file);

                    const extension = file.type.startsWith('audio/') ? 'ogg' : 'mp4';
                    const newMimeType = file.type.startsWith('audio/') ? 'audio/ogg' : 'video/mp4';

                    fileToUpload = new File([convertedBlob], `converted_${Date.now()}.${extension}`, {
                        type: newMimeType
                    });
                    finalType = newMimeType;
                    console.log(`✅ Conversion successful: ${finalType}`);
                } catch (convErr) {
                    console.warn('⚠️ Conversion failed, sending original file:', convErr);
                }
            }

            const filename = `${Date.now()}_${fileToUpload.name}`;
            const { data, error } = await supabase.storage
                .from('chat-media')
                .upload(`${activeSession.name}/${selectedLead.id}/${filename}`, fileToUpload);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-media')
                .getPublicUrl(`${activeSession.name}/${selectedLead.id}/${filename}`);

            const payload = {
                session: activeSession.name,
                chatId: selectedLead.chat_id || selectedLead.phone,
                file: {
                    url: publicUrl,
                    headers: [['Content-Type', finalType]]
                },
                caption: file.name
            };

            // Detect type and send appropriate request
            if (finalType.startsWith('image/')) {
                await wahaService.sendImage(payload);
            } else if (finalType.startsWith('audio/') || finalType === 'audio/ogg') {
                // Waha expects { url } for voice/audio
                await wahaService.sendVoice({ ...payload, file: { url: publicUrl } });
            } else if (finalType.startsWith('video/')) {
                await wahaService.sendVideo(payload);
            } else {
                await wahaService.sendFile(payload);
            }

            // Note: Socket will handle the incoming message update
        } catch (error) {
            console.error('Upload Error:', error);
            alert('Erro ao enviar arquivo');
        }
    };

    const setActiveSession = (session) => {
        if (setParentActiveSession) setParentActiveSession(session);
    };

    // Check localStorage for createNewSession flag on mount
    useEffect(() => {
        if (localStorage.getItem('createNewSession') === 'true') {
            setIsCreatingNew(true);
            localStorage.removeItem('createNewSession');
        }
    }, []);

    // Derived states
    const sessionStatus = activeSession?.status;

    const isStarting = sessionStatus === 'STARTING';
    const isScanning = sessionStatus === 'SCAN_QR_CODE';
    const isStopped = sessionStatus === 'STOPPED';
    const isFailed = sessionStatus === 'FAILED';
    const isWorking = sessionStatus === 'WORKING';

    // UI LOGIC:
    // If we have an active session, show the Chat UI (Step 3) for ALL states
    // EXCEPT when we explicitly need to scan a QR code (Step 2).
    // The Status Banner will handle warnings for STOPPED/FAILED/STARTING.
    const isConnected = activeSession && !isScanning && !isCreatingNew;

    const needsReconnect = hasSession && (isStopped || isFailed) && !isCreatingNew;
    const isNewUser = !hasSession || isCreatingNew;

    // Only show "Connecting" screen if we are strictly scanning QR
    const isConnecting = isScanning;

    // Steps based on user state
    const getSteps = () => {
        if (isNewUser) {
            return [
                { id: 1, label: 'Criar Sessão' },
                { id: 2, label: 'Conectar' },
                { id: 3, label: 'Pronto!' }
            ];
        } else {
            return [
                { id: 1, label: 'Reconectar' },
                { id: 2, label: 'Conectar' },
                { id: 3, label: 'Pronto!' }
            ];
        }
    };

    const getCurrentStep = () => {
        if (isConnected) return 3;
        if (isConnecting) return 2;
        return 1;
    };

    const steps = getSteps();
    const currentStep = getCurrentStep();

    // Sync hasSession with parent sessions
    useEffect(() => {
        setHasSession(sessions && sessions.length > 0);
    }, [sessions]);

    // Load chats from database
    useEffect(() => {
        const loadChats = async () => {
            if (!activeSession) {
                setIsLoadingData(false);
                return;
            }

            // Check cache for this specific session on switch
            const cached = getChatCache(activeSession.name);
            if (cached) {
                setLeads(cached);
                setIsLoadingData(false);
            } else {
                setIsLoadingData(true);
            }

            try {
                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('session_name', activeSession.name)
                    .order('last_message_at', { ascending: false });

                if (error) {
                    console.log('Error loading chats:', error.message);
                }
                const result = data || [];
                setLeads(result);
                setChatCache(activeSession.name, result); // Cache the result

                // Restore selection if exists
                const lastId = localStorage.getItem('lastSelectedChatId');
                if (lastId && !selectedLead) {
                    const restored = result.find(l => l.id === lastId);
                    if (restored) setSelectedLead(restored);
                }
            } catch (e) {
                console.log('Chats not available');
            } finally {
                setIsLoadingData(false);
            }
        };
        loadChats();
    }, [activeSession?.name]); // Run when session changes

    // 🤖 Auto-Subscribe Presence for ALL loaded chats
    useEffect(() => {
        const subscribeAll = async () => {
            // Only subscribe if session is actually working
            if (activeSession && activeSession.status === 'WORKING' && leads?.length > 0) {
                // console.log(`💓 Presence Sync: Subscribing ${leads.length} contacts...`);

                // Batch processing to prevent network storm (1000 contacts support)
                const CHUNK_SIZE = 20;
                const DELAY_MS = 500;
                const chunks = [];

                // Create chunks
                for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
                    chunks.push(leads.slice(i, i + CHUNK_SIZE));
                }

                // Process chunks sequentially
                for (const chunk of chunks) {
                    // Fire chunk in parallel
                    await Promise.all(chunk.map(lead => {
                        const targetId = lead.chat_id || lead.id;
                        if (targetId) return wahaService.subscribePresence(activeSession.name, targetId).catch(() => { });
                        return Promise.resolve();
                    }));

                    // Wait before next chunk to be gentle on server
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }
        };

        // Re-subscribe heartbeat - keeps presence connections alive in WAHA
        // Increased interval to 60s for stability with large lists
        const presenceInterval = setInterval(subscribeAll, 60000);

        // Initial subscription
        subscribeAll();

        return () => clearInterval(presenceInterval);
    }, [activeSession?.name, leads?.length]);

    // Real-time Socket Listeners (Separated for stability)
    useEffect(() => {
        const socket = wahaService.socket;

        const handlePresenceUpdate = (payload) => {
            let { chatId, originalId, status, lastSeen } = payload;
            if (status) {
                // Standardize Status
                let stdStatus = status.toLowerCase();

                // Explicitly check for recording first
                if (stdStatus === 'recording') stdStatus = 'recording';
                else if (stdStatus === 'composing' || stdStatus === 'typing') stdStatus = 'typing';
                else if (stdStatus === 'available' || stdStatus === 'online' || stdStatus === 'paused') stdStatus = 'online';
                else if (stdStatus === 'unavailable' || stdStatus === 'offline') stdStatus = 'offline';

                const normChatId = normalizeJid(chatId);
                const normOriginalId = normalizeJid(originalId);

                setPresence(prev => {
                    const next = { ...prev };
                    let changed = false;

                    if (normChatId && prev[normChatId] !== stdStatus) {
                        next[normChatId] = stdStatus;
                        changed = true;
                    }
                    if (normOriginalId && normOriginalId !== normChatId && prev[normOriginalId] !== stdStatus) {
                        next[normOriginalId] = stdStatus;
                        changed = true;
                    }
                    return changed ? next : prev;
                });

                // Update Realtime Last Seen locally
                if (lastSeen) {
                    setLeads(prev => prev.map(l => {
                        const lJid = normalizeJid(l.chat_id || l.id);
                        if (lJid === normChatId || lJid === normOriginalId) {
                            return { ...l, last_seen: lastSeen };
                        }
                        return l;
                    }));

                    // Update selected lead if active
                    setSelectedLead(prev => {
                        if (prev) {
                            const pJid = normalizeJid(prev.chat_id || prev.id);
                            if (pJid === normChatId || pJid === normOriginalId) {
                                return { ...prev, last_seen: lastSeen };
                            }
                        }
                        return prev;
                    });
                }
            }
        };

        const handleChatUpdate = (payload) => {
            console.log('⚡ Chat Update (Socket):', payload);

            // Prefer explicit chatJid from backend (WA ID) for matching
            // Fallback to chatId (UUID) or other variations
            const targetJid = payload.chatJid || payload.chat?.chat_id;
            const targetUuid = payload.chatId || payload.chat?.id;

            const msg = payload.message || payload;

            // Allow 'text' type fallback if body exists
            const type = msg.type || 'text';
            const body = msg.body || (['image', 'video', 'ptt', 'audio'].includes(type) ? (type === 'ptt' || type === 'audio' ? 'Áudio' : 'Mídia') : msg.body);

            const timestamp = msg.timestamp || new Date().toISOString();

            if (!targetJid && !targetUuid) return;

            setLeads(prevLeads => {
                const normTargetJid = normalizeJid(targetJid);

                const existingIndex = prevLeads.findIndex(l => {
                    // Match by WA ID (Preferred)
                    if (targetJid && normalizeJid(l.chat_id) === normTargetJid) return true;
                    // Match by UUID 
                    if (targetUuid && l.id === targetUuid) return true;
                    // Fallback to legacy ID check
                    if (normalizeJid(l.id) === normTargetJid) return true;
                    return false;
                });

                if (existingIndex > -1) {
                    const updatedLeads = [...prevLeads];
                    const chat = updatedLeads[existingIndex];

                    // Remove from current position
                    updatedLeads.splice(existingIndex, 1);

                    // Add to top with updated info
                    updatedLeads.unshift({
                        ...chat,
                        last_message: body || 'Nova mensagem', // Force a string if empty
                        last_message_at: timestamp
                    });
                    return updatedLeads;
                } else {
                    // NEW CHAT HANDLING
                    // Construct a new lead object matching the DB shape
                    const newChat = {
                        id: targetUuid || payload.chat?.id, // UUID
                        chat_id: targetJid || payload.chat?.chat_id, // WA ID
                        name: payload.chat?.name || payload.chat?.phone || 'Novo Contato',
                        phone: payload.chat?.phone,
                        is_group: payload.chat?.isGroup,
                        last_message: body || 'Nova mensagem',
                        last_message_at: timestamp,
                        session_name: activeSession?.name,
                        unread_count: 1 // Assume 1 unread since it's new
                    };

                    console.log('✨ New chat detected via socket:', newChat);

                    // Add to top of list
                    return [newChat, ...prevLeads];
                }
            });
        };

        // NEW: Handle Lead Status Update (for AI Control)
        const handleLeadUpdate = (payload) => {
            console.log('🤖 Lead Status Update:', payload);
            const { leadId, status, chatId } = payload;

            setLeads(prev => prev.map(lead => {
                // Try to match by lead ID (campaign_leads id) or chat ID
                // Note: We need to ensure we map campaign_leads.id to a property on the lead object
                if (lead.campaign_lead_id === leadId || lead.id === chatId) {
                    return { ...lead, campaign_status: status };
                }
                return lead;
            }));

            // Update selected lead if it matches
            setSelectedLead(prev => {
                if (!prev) return prev;
                if (prev.campaign_lead_id === leadId || prev.id === chatId) {
                    return { ...prev, campaign_status: status };
                }
                return prev;
            });
        };

        if (socket && activeSession) {
            socket.on('message', handleChatUpdate);
            socket.on('presence.update', handlePresenceUpdate);
            socket.on('lead.update', handleLeadUpdate); // Register listener

            // Re-connect logic
            const onConnect = () => {
                console.log('🟢 Socket Reconnected');
            };
            socket.on('connect', onConnect);

            return () => {
                socket.off('message', handleChatUpdate);
                socket.off('presence.update', handlePresenceUpdate);
                socket.off('lead.update', handleLeadUpdate);
                socket.off('connect', onConnect);
            };
        }
    }, [activeSession?.name]); // Only re-run if session changes

    // Fetch messages for selected chat
    useEffect(() => {
        if (!selectedLead) return;

        // Subscribe to presence (typing/online) for this chat
        if (activeSession) {
            console.log('🔔 Subscribing to presence for:', selectedLead.chat_id || selectedLead.id);
            // Use chat_id (WA ID) if available, otherwise fallback to id (might be formatted phone)
            wahaService.subscribePresence(activeSession.name, selectedLead.chat_id || selectedLead.id);
        }

        const fetchMessages = async () => {
            const currentChatId = selectedLead.id;

            // Check cache first
            const cachedMsgs = getMessageCache(currentChatId);
            if (cachedMsgs) {
                setMessages(cachedMsgs);
                setIsLoadingMessages(false);
            } else {
                setMessages([]); // Clear previous messages if no cache
                setIsLoadingMessages(true);
            }

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', selectedLead.id)
                .order('timestamp', { ascending: true });

            if (data) {
                setMessages(data);
                setMessageCache(selectedLead.id, data);
            }
            setIsLoadingMessages(false);
        };

        fetchMessages();

        // Socket.io for instant updates
        const socket = wahaService.socket;

        console.log('🔌 Setup socket listener for chat:', selectedLead.id);

        const handleNewMessage = (payload) => {
            console.log('📨 Socket received message:', payload);

            // Check if message belongs to current chat
            const msgChatId = payload.chatId || payload.chat?.id;
            const currentChatId = selectedLead.id;

            if (msgChatId === currentChatId) {
                console.log('✨ Message matches current chat! Updating state...');
                // Determine structure based on payload
                const newMsg = payload.message || payload; // fallback

                setMessages(prev => {
                    // Avoid duplicates
                    const exists = prev.some(m => {
                        if (m.id === newMsg.id) return true;
                        if (m.message_id && newMsg.message_id && m.message_id === newMsg.message_id) return true;
                        return false;
                    });

                    if (exists) {
                        console.log('⚠️ Duplicate message ignored:', newMsg.id);
                        return prev;
                    }

                    console.log('✅ Adding new message to state:', newMsg.id);

                    // Normalize snake_case for frontend rendering
                    const normalizedMsg = {
                        ...newMsg,
                        from_me: newMsg.from_me !== undefined ? newMsg.from_me : newMsg.fromMe,
                        media_url: newMsg.media_url || newMsg.mediaUrl,
                        chat_id: selectedLead.id // ensure consistency
                    };

                    return [...prev, normalizedMsg];
                });
            } else {
                console.log('❌ Message ignored (wrong chat):', { msgChatId, currentChatId });
            }
        };

        if (socket) {
            // socket.off('message') REMOVED: This was killing the sidebar listener!
            socket.on('message', handleNewMessage);
            socket.on('connect', () => console.log('🟢 Socket connected:', socket.id));
            socket.on('disconnect', () => console.log('🔴 Socket disconnected'));
            socket.on('connect_error', (err) => console.log('⚠️ Socket error:', err));
        }

        return () => {
            console.log('🔌 Cleanup socket listener for:', selectedLead.id);
            if (socket) {
                socket.off('message', handleNewMessage);
                socket.off('connect');
                socket.off('disconnect');
                socket.off('connect_error');
            }
        };
    }, [selectedLead?.id]);

    // Poll for QR screenshot
    useEffect(() => {
        if (!isScanning || !activeSession) return;

        const fetchScreenshot = async () => {
            try {
                const data = await wahaService.getScreenshot(activeSession.name);
                if (data) setQrCode(data);
            } catch (e) { }
        };

        fetchScreenshot();
        const interval = setInterval(fetchScreenshot, 3000);
        return () => clearInterval(interval);
    }, [isScanning, activeSession?.name]);

    // Load Chats (Updated to include Campaign/Lead Status)
    useEffect(() => {
        const loadChats = async () => {
            if (!activeSession) {
                setIsLoadingData(false);
                return;
            }

            // Check cache for this specific session on switch
            const cached = getChatCache(activeSession.name);
            if (cached) {
                setLeads(cached);
                setIsLoadingData(false);
            } else {
                setIsLoadingData(true);
            }

            try {
                // Fetch chats with JOIN enabled on campaign_leads to get status
                // Approach: Fetch chats, then fetch active leads for this session/user, then merge.

                const { data: chatsData, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('session_name', activeSession.name)
                    .order('last_message_at', { ascending: false });

                if (error) {
                    console.log('Error loading chats:', error.message);
                }

                let result = chatsData || [];

                // Fetch Active Leads Statuses
                const { data: leadsData } = await supabase
                    .from('campaign_leads')
                    .select('id, phone, status, campaign_id')
                    .neq('status', 'converted')
                    .neq('status', 'lost')
                    .neq('status', 'junk');

                if (leadsData && leadsData.length > 0) {
                    // MERGE Logic
                    result = result.map(chat => {
                        const chatPhone = chat.phone ? chat.phone.replace(/\D/g, '') : '';
                        const matchingLead = leadsData.find(l => {
                            const leadPhone = l.phone.replace(/\D/g, '');
                            return leadPhone.endsWith(chatPhone.slice(-8));
                        });

                        if (matchingLead) {
                            return {
                                ...chat,
                                campaign_status: matchingLead.status,
                                campaign_lead_id: matchingLead.id
                            };
                        }
                        return chat;
                    });
                }

                setLeads(result);
                setChatCache(activeSession.name, result);

                // Restore selection if exists
                const lastId = localStorage.getItem('lastSelectedChatId');
                if (lastId && !selectedLead) {
                    const restored = result.find(l => l.id === lastId);
                    if (restored) setSelectedLead(restored);
                }
            } catch (e) {
                console.log('Chats not available');
            } finally {
                setIsLoadingData(false);
            }
        };
        loadChats();
    }, [activeSession?.name]);

    // Auto-scroll to bottom whenever messages update OR presence changes (if typing bubble appears)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, presence]);

    if (sessions === null || (sessions.length > 0 && !activeSession)) {
        return <ChatsSkeleton />;
    }

    const handleCreateSession = async () => {
        if (!sessionName.trim()) return;
        setIsCreatingSession(true);
        const name = sessionName.trim();
        try {
            await wahaService.createSession({ name, start: true });
            await new Promise(r => setTimeout(r, 1000));
            // Refresh parent sessions
            if (refreshSessions) await refreshSessions();
            setActiveSession({ name, status: 'STARTING' });
            setHasSession(true);
            setIsCreatingNew(false);
            // Remember this session
            localStorage.setItem('lastSessionName', name);
        } catch (e) {
            // Session might already exist, try to start it
            try {
                await wahaService.startSession(name);
                setActiveSession({ name, status: 'STARTING' });
                setHasSession(true);
                setIsCreatingNew(false);
                localStorage.setItem('lastSessionName', name);
            } catch (e2) { }
        } finally {
            setIsCreatingSession(false);
        }
    };

    const handleStartSession = async () => {
        if (!activeSession) return;
        setIsActionLoading(true);
        try {
            await wahaService.startSession(activeSession.name);
            await new Promise(r => setTimeout(r, 1000));
            const data = await wahaService.getSessions();
            if (data?.length > 0) {
                setSessions(data);
                setActiveSession(data.find(s => s.name === activeSession.name) || data[0]);
            }
        } catch (e) { } finally {
            setIsActionLoading(false);
        }
    };

    const handleTakeControl = async () => {
        if (!selectedLead || !selectedLead.campaign_lead_id) return;

        try {
            // Optimistic Update
            const updatedLead = { ...selectedLead, campaign_status: 'manual_intervention' };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? updatedLead : l));

            const response = await fetch('http://localhost:3000/api/campaigns/stop-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: selectedLead.campaign_lead_id,
                    chatId: selectedLead.id
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('✅ Lead stopped successfully');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to take control:', error);
            alert('Erro ao assumir controle. Tente novamente.');
        }
    };

    // Is AI Active?
    const isAIActive = selectedLead?.campaign_status &&
        ['pending', 'contacted', 'responded', 'negotiating', 'qualified'].includes(selectedLead.campaign_status);

    if (isLoadingData) {
        return <ChatsSkeleton />;
    }

    // Step Progress Indicator
    const StepIndicator = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '48px' }}>
            {steps.map((step, i) => (
                <React.Fragment key={step.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: currentStep >= step.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s',
                            boxShadow: currentStep >= step.id ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none'
                        }}>
                            {currentStep > step.id ? (
                                <Check size={16} color="white" />
                            ) : (
                                <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{step.id}</span>
                            )}
                        </div>
                        <span style={{
                            fontSize: '13px',
                            color: currentStep >= step.id ? '#e4e4e7' : '#71717a',
                            fontWeight: currentStep === step.id ? 600 : 400
                        }}>
                            {step.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div style={{
                            width: '60px',
                            height: '2px',
                            background: currentStep > step.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.3s'
                        }} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    // If connected, show normal chat interface
    if (isConnected) {
        return (
            <div style={{ height: '100%', display: 'flex', width: '100%', background: '#F8FAFC', overflow: 'hidden' }}>
                <style>{`
                    @keyframes dropdownIn {
                        from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-dropdown { animation: dropdownIn 0.2s ease-out forwards; }
                `}</style>

                {/* Left Column: Solid & Continuous */}
                <div style={{
                    width: '360px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#FFFFFF',
                    borderRight: '1px solid #E2E8F0',
                    height: '100%',
                    flexShrink: 0
                }}>
                    {/* LEFT COLUMN HEADER STRUCTURE */}

                    {/* Layer 1: Title & Session Controls (Height 64px - Horizon) */}
                    <div style={{
                        height: '64px',
                        minHeight: '64px',
                        padding: '0 16px',
                        borderBottom: '1px solid #E2E8F0', // Horizon Line
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0
                    }}>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#0F172A',
                            letterSpacing: '-0.02em',
                            margin: 0
                        }}>
                            Conversas
                        </h2>

                        {/* Session Controls - Harmonized Group */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '32px' }}>
                            {/* Session Group Container */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#F8FAFC',
                                padding: '0 10px', // Balanced padding
                                borderRadius: '6px',
                                border: '1px solid #F1F5F9',
                                height: '32px' // Explicit Height for Symmetry
                            }}>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    SESSÃO
                                </span>

                                {/* Custom Selector Trigger */}
                                <div style={{ position: 'relative', height: '100%' }}>
                                    <div
                                        onClick={() => setIsSessionSelectorOpen(!isSessionSelectorOpen)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            height: '100%',
                                            paddingRight: '4px'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: '#1E293B'
                                        }}>
                                            {activeSession?.name || 'Selecione'}
                                        </div>
                                        <ChevronDown size={14} color="#64748B" />
                                    </div>

                                    {/* Custom Floating Menu */}
                                    {isSessionSelectorOpen && (
                                        <>
                                            {/* Click Outside Overlay */}
                                            <div
                                                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                                onClick={() => setIsSessionSelectorOpen(false)}
                                            />

                                            <div style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 8px)',
                                                left: '-12px',
                                                background: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '12px',
                                                padding: '6px',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                minWidth: '180px',
                                                zIndex: 100,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                animation: 'fadeIn 0.1s ease-out'
                                            }}>
                                                {sessions?.map(s => (
                                                    <div
                                                        key={s.name}
                                                        onClick={() => {
                                                            setActiveSession(s);
                                                            setIsSessionSelectorOpen(false);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F0F9FF'} // Light Blue Hover
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        {/* Status Dot */}
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            background: s.status === 'WORKING' ? '#22c55e' : (s.status === 'STOPPED' ? '#94a3b8' : '#f59e0b'),
                                                            flexShrink: 0
                                                        }} />

                                                        <span style={{
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: '#334155'
                                                        }}>
                                                            {s.name}
                                                        </span>

                                                        {/* Checkmark for Active */}
                                                        {activeSession?.name === s.name && (
                                                            <Check size={14} color="#3b82f6" style={{ marginLeft: 'auto' }} />
                                                        )}
                                                    </div>
                                                ))}
                                                {(!sessions || sessions.length === 0) && (
                                                    <div style={{ padding: '8px 12px', fontSize: '13px', color: '#94a3b8' }}>
                                                        Nenhuma sessão encontrada.
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions Menu Button - Matching Height (32px) */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setIsSessionMenuOpen(!isSessionMenuOpen)}
                                    style={{
                                        width: '32px', height: '32px', // Square 32px
                                        borderRadius: '6px', background: 'transparent',
                                        color: '#64748B', border: '1px solid transparent', // Ready for hover border
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {isSessionMenuOpen && (
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                        width: '180px', background: '#fff', borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px', zIndex: 100, border: '1px solid #f1f5f9'
                                    }}>
                                        <button onClick={async () => {
                                            if (!activeSession) return;
                                            setActiveSession({ ...activeSession, status: 'STARTING' });
                                            setIsSessionMenuOpen(false);
                                            showToast('Iniciando sessão...', 'success');
                                            try { await wahaService.startSession(activeSession.name); } catch (e) { /* Ignore benign errors */ }
                                            refreshSessions();
                                        }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981' }}>
                                            <Play size={14} /> Iniciar
                                        </button>

                                        <button onClick={async () => {
                                            if (!activeSession) return;
                                            setActiveSession({ ...activeSession, status: 'STARTING' });
                                            setIsSessionMenuOpen(false);
                                            showToast('Reiniciando sessão...', 'info');
                                            try { await wahaService.restartSession(activeSession.name); } catch (e) { }
                                            refreshSessions();
                                        }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#3B82F6' }}>
                                            <RefreshCw size={14} /> Reiniciar
                                        </button>

                                        <button onClick={async () => {
                                            if (!activeSession) return;
                                            setActiveSession({ ...activeSession, status: 'STOPPED' });
                                            setIsSessionMenuOpen(false);
                                            showToast('Sessão parada.', 'error');
                                            try { await wahaService.stopSession(activeSession.name); } catch (e) { }
                                            refreshSessions();
                                        }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
                                            <WifiOff size={14} /> Parar
                                        </button>

                                        <button onClick={async () => {
                                            if (!activeSession) return;
                                            if (!window.confirm('Tem certeza que deseja sair desta sessão?')) return;
                                            setIsSessionMenuOpen(false);
                                            showToast('Desconectando...', 'error');
                                            try { await wahaService.logoutSession(activeSession.name); } catch (e) { }
                                            refreshSessions();
                                        }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444' }}>
                                            <LogOut size={14} /> Sair (Logout)
                                        </button>

                                        <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                                        <button onClick={() => { localStorage.setItem('createNewSession', 'true'); window.location.reload(); }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B' }}>
                                            <Plus size={14} /> Nova Sessão
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Layer 2: Search (Height 52px - Satellite Strip) */}
                    <div style={{
                        height: '52px',
                        minHeight: '52px',
                        padding: '0 16px',
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        background: '#FFFFFF'
                    }}>
                        <Search size={16} color="#94A3B8" />
                        <input
                            type="text"
                            placeholder="Buscar contatos..."
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            style={{
                                flex: 1,
                                height: '100%',
                                border: 'none',
                                background: 'transparent',
                                color: '#1E293B',
                                fontSize: '14px',
                                outline: 'none',
                                padding: 0
                            }}
                        />
                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                            <SlidersHorizontal size={14} color="#64748B" />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                        {leads.length > 0 ? leads.map((lead) => (
                            <div
                                key={lead.id}
                                onClick={() => setSelectedLead(lead)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({
                                        show: true,
                                        x: e.clientX, // Use Viewport coordinates for fixed positioning
                                        y: e.clientY,
                                        chatId: lead.id
                                    });
                                }}
                                style={{
                                    padding: '16px 20px', // Respiro aumentado
                                    borderBottom: '1px solid #F1F5F9', // Divisor horizontal
                                    background: selectedLead?.id === lead.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent', // Pale blue highlight
                                    cursor: 'pointer',
                                    display: 'flex',
                                    gap: '16px',
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                            >
                                {/* Active Indicator Bar */}
                                {selectedLead?.id === lead.id && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '3px',
                                        background: '#3B82F6'
                                    }} />
                                )}

                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#64748B', fontSize: '14px', fontWeight: '600'
                                }}>
                                    {(lead.name || lead.phone)?.substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {lead.name || lead.phone || 'Desconhecido'}
                                            {/* AI ACTIVE BADGE */}
                                            {['pending', 'contacted', 'responded', 'negotiating', 'qualified'].includes(lead.campaign_status) && (
                                                <div style={{
                                                    fontSize: '9px', fontWeight: '700', color: '#7C3AED',
                                                    background: '#EDE9FE', padding: '1px 5px', borderRadius: '4px',
                                                    border: '1px solid #DDD6FE', letterSpacing: '0.02em'
                                                }}>
                                                    AI
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Dot */}
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: (presence[normalizeJid(lead.chat_id)] === 'online' || presence[normalizeJid(lead.id)] === 'online') ? '#22c55e' :
                                                (presence[normalizeJid(lead.chat_id)] === 'recording' || presence[normalizeJid(lead.id)] === 'recording') ? '#EF4444' :
                                                    (presence[normalizeJid(lead.chat_id)] === 'typing' || presence[normalizeJid(lead.id)] === 'typing') ? '#3b82f6' : '#E2E8F0',
                                            transition: 'background 0.3s ease'
                                        }} title={presence[normalizeJid(lead.chat_id)] || presence[normalizeJid(lead.id)] || 'Visto por último'} />
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {presence[normalizeJid(lead.chat_id)] === 'recording' || presence[normalizeJid(lead.id)] === 'recording' ? (
                                            <span style={{ color: '#EF4444', fontWeight: '500' }}>Gravando áudio...</span>
                                        ) : presence[normalizeJid(lead.chat_id)] === 'typing' || presence[normalizeJid(lead.id)] === 'typing' ? (
                                            <span style={{ color: '#3b82f6', fontWeight: '500' }}>Digitando...</span>
                                        ) : (
                                            lead.last_message || 'Nenhuma mensagem...'
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                                <p style={{ fontSize: '13px' }}>Nenhuma conversa.</p>
                            </div>
                        )}
                    </div>
                </div>



                {/* Right Column: Chat Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
                    {selectedLead ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'var(--bg-secondary)',
                            height: '100%'
                        }}>
                            {/* Chat Header - ALIGNMENT TARGET (Height 64px) */}
                            <div style={{
                                height: '64px', // Horizon Match (64px)
                                minHeight: '64px',
                                padding: '0 24px',
                                borderBottom: '1px solid #E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                background: 'var(--bg-secondary)',
                                zIndex: 10
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    flexShrink: 0
                                }}>
                                    {(selectedLead.name || selectedLead.phone)?.substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{selectedLead.name || selectedLead.phone || 'Desconhecido'}</div>
                                    <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: (presence[normalizeJid(selectedLead.chat_id)] === 'online' || presence[normalizeJid(selectedLead.id)] === 'online') ? '#22c55e' :
                                                (presence[normalizeJid(selectedLead.chat_id)] === 'recording' || presence[normalizeJid(selectedLead.id)] === 'recording') ? '#EF4444' :
                                                    (presence[normalizeJid(selectedLead.chat_id)] === 'typing' || presence[normalizeJid(selectedLead.id)] === 'typing') ? '#3B82F6' : '#94A3B8',
                                            transition: 'all 0.3s ease'
                                        }} />
                                        <span
                                            key={presence[normalizeJid(selectedLead.chat_id)] === 'recording' || presence[normalizeJid(selectedLead.id)] === 'recording' ? 'recording' :
                                                presence[normalizeJid(selectedLead.chat_id)] === 'typing' || presence[normalizeJid(selectedLead.id)] === 'typing' ? 'typing' :
                                                    presence[normalizeJid(selectedLead.chat_id)] === 'online' || presence[normalizeJid(selectedLead.id)] === 'online' ? 'online' : 'offline'}
                                            className="animate-status-change"
                                            style={{
                                                display: 'inline-block', // Required for transform animation
                                                color: (presence[normalizeJid(selectedLead.chat_id)] === 'recording' || presence[normalizeJid(selectedLead.id)] === 'recording') ? '#EF4444' :
                                                    (presence[normalizeJid(selectedLead.chat_id)] === 'typing' || presence[normalizeJid(selectedLead.id)] === 'typing') ? '#3B82F6' : '#94A3B8',
                                                fontWeight: (presence[normalizeJid(selectedLead.chat_id)] === 'typing' || presence[normalizeJid(selectedLead.id)] === 'typing' || presence[normalizeJid(selectedLead.chat_id)] === 'recording' || presence[normalizeJid(selectedLead.id)] === 'recording') ? '600' : '400'
                                            }}>
                                            {presence[normalizeJid(selectedLead.chat_id)] === 'recording' || presence[normalizeJid(selectedLead.id)] === 'recording' ? 'Gravando áudio...' :
                                                presence[normalizeJid(selectedLead.chat_id)] === 'typing' || presence[normalizeJid(selectedLead.id)] === 'typing' ? 'Digitando...' :
                                                    (presence[normalizeJid(selectedLead.chat_id)] === 'online' || presence[normalizeJid(selectedLead.id)] === 'online' ? 'Online' :
                                                        formatLastSeen(selectedLead.last_seen))}
                                        </span>
                                    </div>
                                </div>

                                {/* Header Actions */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowChatMenu(!showChatMenu)}
                                        style={{
                                            border: 'none',
                                            cursor: 'pointer',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#64748B',
                                            transition: 'all 0.2s',
                                            background: showChatMenu ? '#F1F5F9' : 'transparent'
                                        }}
                                    >
                                        <MoreVertical size={18} />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showChatMenu && (
                                        <>
                                            <div
                                                onClick={() => setShowChatMenu(false)}
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                top: '40px',
                                                right: 0,
                                                width: '180px',
                                                background: '#FFFFFF',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                border: '1px solid #E2E8F0',
                                                zIndex: 100,
                                                padding: '6px',
                                                animation: 'dropdownIn 0.2s ease-out forwards'
                                            }}>
                                                <button
                                                    onClick={handleDeleteMessages}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        color: '#EF4444',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <Trash2 size={16} />
                                                    Apagar mensagens
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Status Banner - Show if NOT working AND NOT starting (User wants it hidden while starting) */}
                            {sessionStatus !== 'WORKING' && sessionStatus !== 'STARTING' && (
                                <div style={{
                                    padding: '8px 16px',
                                    background: sessionStatus === 'STARTING' ? '#FEF3C7' : '#FEE2E2',
                                    color: sessionStatus === 'STARTING' ? '#92400E' : '#991B1B',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    {sessionStatus === 'STARTING' ? (
                                        <>
                                            <Loader size={14} className="animate-spin" />
                                            Aguarde... Conectando ao WhatsApp
                                        </>
                                    ) : sessionStatus === 'SCAN_QR_CODE' ? (
                                        <>
                                            <Camera size={14} />
                                            Sessão desconectada. Escaneie o QR Code.
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={14} />
                                            Sessão desconectada ou falha. Verifique a conexão.
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Messages Area */}
                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {
                                    messages.length > 0 ? (() => {
                                        let lastDateLabel = null;
                                        return messages.map((msg, index) => {
                                            const currentDateLabel = getDateLabel(msg.timestamp);
                                            const showSeparator = currentDateLabel !== lastDateLabel;
                                            lastDateLabel = currentDateLabel;

                                            return (
                                                <React.Fragment key={msg.id}>
                                                    {showSeparator && (
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            margin: '16px 0',
                                                            position: 'relative'
                                                        }}>
                                                            <div style={{
                                                                background: '#F1F5F9', // Pale gray/blue background
                                                                color: '#64748B', // Muted slate color
                                                                padding: '6px 16px',
                                                                borderRadius: '12px',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.5px',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                            }}>
                                                                {currentDateLabel}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="animate-slide-in" style={{
                                                        alignSelf: msg.from_me ? 'flex-end' : 'flex-start',
                                                        maxWidth: '65%',
                                                        padding: '12px 18px',
                                                        borderRadius: '18px',
                                                        background: msg.from_me
                                                            ? (msg.author === 'ai' ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)')
                                                            : '#FFFFFF',
                                                        color: msg.from_me ? '#ffffff' : '#1E293B',
                                                        fontSize: '14.5px',
                                                        lineHeight: '22px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                        borderBottomRightRadius: msg.from_me ? '4px' : '18px',
                                                        borderBottomLeftRadius: msg.from_me ? '18px' : '4px',
                                                        position: 'relative',
                                                        marginBottom: '4px',
                                                        border: !msg.from_me ? '1px solid #F1F5F9' : 'none'
                                                    }}>
                                                        {/* AI Attribution Label */}
                                                        {msg.from_me && msg.author === 'ai' && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '-8px',
                                                                right: '10px',
                                                                background: '#EDE9FE',
                                                                color: '#6D28D9',
                                                                fontSize: '9px',
                                                                fontWeight: '700',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                                border: '1px solid #DDD6FE'
                                                            }}>
                                                                AI
                                                            </div>
                                                        )}
                                                        {/* Media Handling */}
                                                        {(msg.type === 'image' && (msg.media_url || msg.mediaUrl)) && (
                                                            <img
                                                                src={msg.media_url || msg.mediaUrl}
                                                                alt="Imagem"
                                                                style={{
                                                                    maxWidth: '300px',
                                                                    maxHeight: '300px',
                                                                    width: 'auto',
                                                                    height: 'auto',
                                                                    borderRadius: '8px',
                                                                    marginBottom: '4px',
                                                                    display: 'block',
                                                                    objectFit: 'cover',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => window.open(msg.media_url || msg.mediaUrl, '_blank')}
                                                            />
                                                        )}

                                                        {(msg.type === 'video' && (msg.media_url || msg.mediaUrl)) && (
                                                            <video
                                                                src={msg.media_url || msg.mediaUrl}
                                                                controls
                                                                style={{
                                                                    maxWidth: '300px',
                                                                    maxHeight: '300px',
                                                                    borderRadius: '8px',
                                                                    marginBottom: '4px'
                                                                }}
                                                            />
                                                        )}

                                                        {((msg.type === 'ptt' || msg.type === 'audio') && (msg.media_url || msg.mediaUrl)) && (
                                                            <MinimalAudioPlayer
                                                                src={msg.media_url || msg.mediaUrl}
                                                                incoming={!msg.from_me}
                                                            />
                                                        )}

                                                        {/* Text body */}
                                                        {msg.body && (msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'ptt' && msg.type !== 'audio' ? msg.body : (msg.body !== 'Mídia' && msg.body !== 'Áudio' ? msg.body : null))}
                                                        <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px', textAlign: 'right', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            {msg.from_me && <Check size={12} style={{ opacity: 0.8 }} />}
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        });
                                    })() : (
                                        <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: '40px' }}>
                                            {isLoadingMessages ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                                    <Loader className="animate-spin" size={20} />
                                                    <p style={{ fontSize: '13px', margin: 0 }}>Carregando mensagens...</p>
                                                </div>
                                            ) : (
                                                <p style={{ fontSize: '13px' }}>Início da conversa</p>
                                            )}
                                        </div>
                                    )
                                }

                                {/* Typing Indicator */}
                                {
                                    (() => {
                                        const targetId = selectedLead.chat_id || selectedLead.phone || selectedLead.id;
                                        const status = presence[targetId];
                                        if (status === 'composing' || status === 'typing') {
                                            return (
                                                <div className="animate-slide-in" style={{
                                                    alignSelf: 'flex-start',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderBottomLeftRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    width: 'fit-content'
                                                }}>
                                                    <span className="typing-dot"></span>
                                                    <span className="typing-dot"></span>
                                                    <span className="typing-dot"></span>
                                                </div>
                                            );
                                        }
                                        if (status === 'recording') {
                                            return (
                                                <div className="animate-slide-in" style={{
                                                    alignSelf: 'flex-start',
                                                    padding: '12px',
                                                    borderRadius: '50%',
                                                    background: 'var(--bg-tertiary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: 'fit-content',
                                                    marginLeft: '10px'
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#EF4444'
                                                    }} className="animate-gentle-bounce">
                                                        <Mic size={20} fill="currentColor" />
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                }
                                <div ref={messagesEndRef} />
                            </div >

                            {/* Input Area or AI Managed Banner */}
                            <div style={{ padding: '0 20px', background: 'transparent', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 40 }}>
                                {isAIActive ? (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '800px',
                                        margin: '0 auto 24px auto',
                                        background: '#F8FAFC',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '16px',
                                        padding: '12px 24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: '#EDE9FE', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', color: '#7C3AED'
                                            }}>
                                                <Sparkles size={16} fill="currentColor" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                                                    IA Ativa
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748B' }}>
                                                    A assistente está conduzindo esta conversa.
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleTakeControl}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                                color: '#1E293B',
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#F1F5F9';
                                                e.currentTarget.style.borderColor = '#CBD5E1';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#FFFFFF';
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                            }}
                                        >
                                            Assumir Controle
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center', // Center horizontally
                                        width: '100%',
                                        maxWidth: '800px',
                                        margin: '0 auto 24px auto', // Float 24px from bottom
                                        position: 'relative'
                                    }}>
                                        {/* Attachment Menu - Relocated & Styled */}
                                        {isAttachMenuOpen && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '60px', // Floating above pill
                                                left: '0', // Aligned with pill start
                                                background: '#FFFFFF',
                                                borderRadius: '16px',
                                                padding: '8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)', // Richer shadow
                                                zIndex: 60,
                                                minWidth: '220px',
                                                border: '1px solid #E2E8F0',
                                                animation: 'fadeIn 0.2s ease-out'
                                            }}>
                                                {[
                                                    { label: 'Documento', icon: FileText, color: '#6366f1', accept: '*', action: 'file' },
                                                    { label: 'Fotos e vídeos', icon: ImageIcon, color: '#3b82f6', accept: 'image/*,video/*', action: 'media' },
                                                    { label: 'Câmera', icon: Camera, color: '#ec4899', action: 'camera' },
                                                ].map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            if (fileInputRef.current) {
                                                                fileInputRef.current.accept = item.accept || '*';
                                                                fileInputRef.current.click();
                                                            }
                                                            setIsAttachMenuOpen(false);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            padding: '12px 16px',
                                                            cursor: 'pointer',
                                                            borderRadius: '12px',
                                                            transition: 'background 0.2s',
                                                            color: '#334155'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <item.icon size={20} color={item.color} />
                                                        <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleFileUpload}
                                        />

                                        {/* Recording / Input */}
                                        {isRecording ? (
                                            <div style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                background: '#FFFFFF',
                                                borderRadius: '9999px',
                                                padding: '8px 16px',
                                                boxShadow: '0 2px 15px rgba(0, 0, 0, 0.03)',
                                                border: '1px solid #E2E8F0',
                                                color: '#ef4444'
                                            }}>
                                                <div className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor' }} />
                                                    <span style={{ fontWeight: 600 }}>{formatTime(recordingTime)}</span>
                                                </div>
                                                <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '14px' }}>Gravando áudio...</span>

                                                <div onClick={handleCancelRecording} style={{ cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                                    <X size={20} />
                                                </div>
                                                <div onClick={() => handleStopRecording(true)} style={{ cursor: 'pointer', color: '#22c55e', padding: '4px' }}>
                                                    <Check size={20} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                background: '#FFFFFF', // Pure White
                                                borderRadius: '9999px', // Perfect Pill
                                                padding: '8px 16px', // Balanced Padding
                                                boxShadow: '0 2px 15px rgba(0, 0, 0, 0.03)', // Subtle Shadow
                                                border: '1px solid #E2E8F0', // Fine Border
                                                transition: 'box-shadow 0.2s',
                                                position: 'relative'
                                            }}
                                                className="hover:shadow-sm focus-within:shadow-sm"
                                            >
                                                {/* Integrated Plus Button (The Only One) */}
                                                <div
                                                    onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        color: isAttachMenuOpen ? 'var(--primary)' : '#64748B',
                                                        transition: 'transform 0.2s',
                                                        transform: isAttachMenuOpen ? 'rotate(45deg)' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    <Plus size={20} />
                                                </div>

                                                <div style={{ cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                                    <Smile size={20} />
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder={sessionStatus === 'WORKING' || sessionStatus === 'STARTING' ? "Digite uma mensagem..." : "Conectando ao WhatsApp..."}
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                    disabled={sessionStatus !== 'WORKING' && sessionStatus !== 'STARTING'}
                                                    style={{
                                                        flex: 1,
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#1E293B',
                                                        outline: 'none',
                                                        fontSize: '14px',
                                                        padding: '0 8px',
                                                        fontWeight: 400,
                                                        opacity: (sessionStatus === 'WORKING' || sessionStatus === 'STARTING') ? 1 : 0.6,
                                                        cursor: (sessionStatus === 'WORKING' || sessionStatus === 'STARTING') ? 'text' : 'not-allowed'
                                                    }}
                                                />

                                                {/* Mic / Send Inside Capsule */}
                                                <div
                                                    onClick={() => {
                                                        if (sessionStatus !== 'WORKING' && sessionStatus !== 'STARTING') return;
                                                        inputValue.trim() ? handleSendMessage() : handleStartRecording();
                                                    }}
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: (sessionStatus === 'WORKING' || sessionStatus === 'STARTING') ? 'pointer' : 'not-allowed',
                                                        color: inputValue.trim() ? '#ffffff' : '#64748B',
                                                        background: (sessionStatus !== 'WORKING' && sessionStatus !== 'STARTING') ? '#E2E8F0' : (inputValue.trim() ? 'var(--primary)' : 'transparent'),
                                                        borderRadius: '50%',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    {inputValue.trim() ? (
                                                        <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
                                                    ) : (
                                                        <Mic size={20} />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div >
                        </div >
                    ) : (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#FFFFFF',
                            borderLeft: '1px solid #E2E8F0',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '24px',
                                background: '#F1F5F9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94A3B8'
                            }}>
                                <MessageSquare size={32} />
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>Nenhuma conversa selecionada</h3>
                                <p style={{ fontSize: '14px', color: '#64748B' }}>Selecione um contato para começar a conversar</p>
                            </div>
                        </div>
                    )}
                </div >

                {/* Context Menu / Delete Chat - Fixed Position */}
                {contextMenu.show && (
                    <div style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        background: '#FFF',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '4px',
                        zIndex: 99999,
                        width: '180px',
                        border: '1px solid #E2E8F0'
                    }}>
                        <button
                            onClick={handleDeleteChat}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                fontSize: '13px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                borderRadius: '6px'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#FEF2F2'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            <Trash2 size={14} /> Apagar conversa
                        </button>
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#94A3B8' }}>
                            Apaga mensagens do banco
                        </div>
                    </div>
                )
                }
                {/* Toast Notification */}
                <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 99999 }}>
                    {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
                </div>
            </div >
        );
    }

    // Onboarding Full Canvas
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '40px'
        }}>
            <StepIndicator />

            <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>

                {/* Step 1: New User - Create Session */}
                {currentStep === 1 && isNewUser && (
                    <>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '24px',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 32px auto'
                        }}>
                            <Wifi size={40} color="#6366f1" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', marginBottom: '12px' }}>
                            Conecte seu WhatsApp
                        </h2>
                        <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.6, marginBottom: '24px' }}>
                            Dê um nome para sua sessão e clique em criar para começar a configuração.
                        </p>

                        <div style={{ marginBottom: '24px' }}>
                            <input
                                type="text"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                placeholder="Nome da sessão (ex: Vendas, Suporte)"
                                style={{
                                    width: '100%',
                                    maxWidth: '300px',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#e4e4e7',
                                    fontSize: '14px',
                                    outline: 'none',
                                    textAlign: 'center'
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                            />
                        </div>

                        <Button
                            onClick={handleCreateSession}
                            disabled={isCreatingSession || !sessionName.trim()}
                        >
                            {isCreatingSession ? 'Criando...' : 'Criar Sessão'}
                        </Button>
                    </>
                )}

                {/* Step 1: Existing User - Reconnect */}
                {currentStep === 1 && needsReconnect && (
                    <>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '24px',
                            background: isFailed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(113, 113, 122, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 32px auto'
                        }}>
                            {isFailed ? (
                                <AlertTriangle size={40} color="#ef4444" />
                            ) : (
                                <WifiOff size={40} color="#71717a" />
                            )}
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', marginBottom: '12px' }}>
                            {isFailed ? 'Conexão Perdida' : 'Sessão Desconectada'}
                        </h2>
                        <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.6, marginBottom: '16px' }}>
                            {isFailed
                                ? 'Houve um problema com sua sessão. Clique abaixo para reconectar ao WhatsApp.'
                                : 'Sua sessão foi pausada. Clique abaixo para reconectar rapidamente.'
                            }
                        </p>
                        <p style={{ fontSize: '13px', color: '#52525b', marginBottom: '24px' }}>
                            Sessão: <strong style={{ color: '#a1a1aa' }}>{activeSession?.name}</strong>
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <Button onClick={handleStartSession} disabled={isActionLoading} icon={Play}>
                                {isActionLoading ? 'Conectando...' : 'Reconectar'}
                            </Button>
                            {isFailed && (
                                <Button
                                    variant="outline"
                                    onClick={() => wahaService.restartSession(activeSession?.name).then(handleStartSession)}
                                    disabled={isActionLoading}
                                    icon={RefreshCw}
                                >
                                    Reiniciar
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {/* Step 2: Starting */}
                {currentStep === 2 && isStarting && (
                    <>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '24px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 32px auto'
                        }}>
                            <Loader size={40} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', marginBottom: '12px' }}>
                            Iniciando Sessão...
                        </h2>
                        <p style={{ fontSize: '15px', color: '#71717a' }}>
                            Aguarde enquanto preparamos sua conexão.
                        </p>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </>
                )}

                {/* Step 2: QR Code */}
                {currentStep === 2 && isScanning && (
                    <>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', marginBottom: '8px' }}>
                            Escaneie o QR Code
                        </h2>
                        <p style={{ fontSize: '15px', color: '#71717a', marginBottom: '24px' }}>
                            Abra o WhatsApp no celular e escaneie
                        </p>
                        <div style={{
                            width: '280px',
                            height: '280px',
                            borderRadius: '16px',
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px auto',
                            padding: '16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                        }}>
                            {qrCode ? (
                                <img
                                    src={`data:${qrCode.mimetype};base64,${qrCode.data}`}
                                    alt="QR Code"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <Loader size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                            )}
                        </div>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', textAlign: 'left' }}>
                            <p style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 500, marginBottom: '8px' }}>
                                📱 Como escanear:
                            </p>
                            <ol style={{ fontSize: '12px', color: '#a1a1aa', paddingLeft: '16px', lineHeight: 1.8, margin: 0 }}>
                                <li>WhatsApp → Menu (⋮) → Aparelhos conectados</li>
                                <li>Conectar um aparelho → Aponte para o QR</li>
                            </ol>
                        </div>
                    </>
                )}
            </div>
            {/* Context Menu / Delete Chat - Fixed Position */}
            {contextMenu.show && (
                <div style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: '#FFF',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '4px',
                    zIndex: 99999,
                    width: '180px',
                    border: '1px solid #E2E8F0'
                }}>
                    <button
                        onClick={handleDeleteChat}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#EF4444',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            borderRadius: '6px'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#FEF2F2'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        <Trash2 size={14} /> Apagar conversa
                    </button>
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#94A3B8' }}>
                        Apaga mensagens do banco
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatsPage;
