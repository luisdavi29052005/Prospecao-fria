
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import {
    Wifi, WifiOff, RefreshCw, Loader, MessageSquare, Check, Play,
    AlertTriangle, Search, Filter, Paperclip, Plus, Image as ImageIcon,
    FileText, Camera, Mic, Smile, X, LogOut, MoreVertical, SlidersHorizontal, ChevronDown
} from 'lucide-react';
import ChatsSkeleton from '../../components/skeletons/ChatsSkeleton';
import MinimalAudioPlayer from '../../components/MinimalAudioPlayer';
import { supabase } from '../../lib/supabaseClient';
import { wahaService } from '../../services/waha';

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

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [leads, setLeads] = useState([]);
    const [hasSession, setHasSession] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [sessionName, setSessionName] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [presence, setPresence] = useState({}); // { chatId: 'composing' | 'recording' | 'available' }

    // Checkpoint for auto-scroll
    const messagesEndRef = useRef(null);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);




    // Use parent session state
    const activeSession = parentActiveSession;
    const sessions = parentSessions; // Can be null (loading)



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

                    // Convert to base64 for WAHA
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);

                    reader.onloadend = async () => {
                        // Strip "data:audio/...;base64," header
                        const base64Data = reader.result.split(',')[1];

                        try {
                            const targetId = selectedLead.chat_id || selectedLead.phone || selectedLead.id;

                            // Force OGG/Opus for WhatsApp compatibility (Waha handles conversion/container)
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
                }
                resolve();
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedLead || !activeSession) return;

        try {
            const filename = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage
                .from('chat-media')
                .upload(`${activeSession.name}/${selectedLead.id}/${filename}`, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-media')
                .getPublicUrl(`${activeSession.name}/${selectedLead.id}/${filename}`);

            const payload = {
                session: activeSession.name,
                chatId: selectedLead.chat_id || selectedLead.phone,
                file: {
                    url: publicUrl,
                    headers: [['Content-Type', file.type]]
                },
                caption: file.name
            };

            // Detect type and send appropriate request
            if (file.type.startsWith('image/')) {
                await wahaService.sendImage(payload);
            } else if (file.type.startsWith('audio/')) {
                // Waha expects { url } for voice/audio
                await wahaService.sendVoice({ ...payload, file: { url: publicUrl } });
            } else if (file.type.startsWith('video/')) {
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
    const isConnected = sessionStatus === 'WORKING';
    const isScanning = sessionStatus === 'SCAN_QR_CODE';
    const isStarting = sessionStatus === 'STARTING';
    const isStopped = sessionStatus === 'STOPPED';
    const isFailed = sessionStatus === 'FAILED';
    const needsReconnect = hasSession && (isStopped || isFailed) && !isCreatingNew;
    const isNewUser = !hasSession || isCreatingNew;
    const isConnecting = isStarting || isScanning;

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
            try {
                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('session_name', activeSession.name)
                    .order('last_message_at', { ascending: false });

                if (error) {
                    console.log('Error loading chats:', error.message);
                }
                setLeads(data || []);
            } catch (e) {
                console.log('Chats not available');
            } finally {
                setIsLoadingData(false);
            }
        };
        loadChats();

        // 🤖 Auto-Subscribe Presence for ALL loaded chats
        // 🤖 Auto-Subscribe Presence for ALL loaded chats
        // This ensures status (Online/Typing) works for automations without clicking
        // Also adding a periodic "heartbeat" to re-subscribe every 30s to keep it alive
        const subscribeAll = () => {
            if (activeSession && leads?.length > 0) {
                console.log('💓 Presence Heartbeat: Subscribing all...');
                leads.forEach(lead => {
                    const targetId = lead.chat_id || lead.phone || lead.id;
                    if (targetId) wahaService.subscribePresence(activeSession.name, targetId);
                });
            }
        };

        subscribeAll(); // Initial call
        const presenceInterval = setInterval(subscribeAll, 30000); // Repeat every 30s

        // Real-time Chat List Updates
        const socket = wahaService.socket;
        const handleChatUpdate = (payload) => {
            console.log('🔄 Chat Update Payload:', payload);
            // Fix: Extract chatId from root payload first
            const chatId = payload.chatId || payload.chat?.id || payload.message?.chatId;
            const msg = payload.message || payload;
            const timestamp = msg.timestamp || new Date().toISOString();
            // Expanded fallback for media types
            const body = msg.body || ((msg.hasMedia || ['image', 'video', 'ptt', 'audio'].includes(msg.type)) ? 'Mídia' : '');

            if (!chatId) return;

            setLeads(prevLeads => {
                const existingIndex = prevLeads.findIndex(l => l.id === chatId || l.chat_id === chatId);

                if (existingIndex > -1) {
                    // Update existing
                    const updatedLeads = [...prevLeads];
                    const chat = updatedLeads[existingIndex];
                    updatedLeads.splice(existingIndex, 1); // remove
                    updatedLeads.unshift({
                        ...chat,
                        last_message: body,
                        last_message_at: timestamp
                    });
                    return updatedLeads;
                } else {
                    console.log(`🆕 New chat detected ${chatId}, reloading...`);
                    // Start full reload for new chats to get proper metadata
                    loadChats();
                    return prevLeads;
                }
            });
        };

        if (socket && activeSession) {
            socket.on('message', handleChatUpdate);

            socket.on('presence.update', (payload) => {
                console.log('👤 Presence Update:', payload);
                if (payload.chatId && payload.status) {
                    setPresence(prev => ({
                        ...prev,
                        [payload.chatId]: payload.status
                    }));
                }
            });

            // Re-subscribe on reconnect
            socket.on('connect', () => {
                console.log('🟢 Socket Reconnected: Refreshing presence...');
                subscribeAll();
            });
        }

        return () => {
            clearInterval(presenceInterval);
            if (socket) {
                socket.off('message', handleChatUpdate);
                socket.off('presence.update');
                socket.off('connect');
            }
        };
    }, [activeSession?.name]);

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
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', selectedLead.id)
                .order('timestamp', { ascending: true });

            if (data) setMessages(data);
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
            socket.off('message'); // Remove any existing listeners to be safe
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

    // Refresh session status
    useEffect(() => {
        if (!hasSession) return;

        const refresh = async () => {
            try {
                let data = await wahaService.getSessions();
                // Just trust getSessions result
                if (data?.length > 0) {
                    setSessions(data);
                    const updated = data.find(s => s.name === activeSession?.name);
                    if (updated) setActiveSession(updated);
                }
            } catch (e) { }
        };

        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [hasSession, activeSession?.name]);

    // Auto-scroll to bottom whenever messages update OR presence changes (if typing bubble appears)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, presence]);

    if (sessions === null) {
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
                            fontWeight: 700,
                            color: '#1E293B',
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
                                        width: '160px', background: '#fff', borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px', zIndex: 100, border: '1px solid #f1f5f9'
                                    }}>
                                        <button onClick={() => { localStorage.setItem('createNewSession', 'true'); window.location.reload(); }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B' }}><Plus size={14} /> Nova Sessão</button>
                                        <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                                        <button onClick={() => { wahaService.stopSession(activeSession?.name).then(refreshSessions); setIsSessionMenuOpen(false); }} style={{ padding: '8px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><WifiOff size={14} /> Parar Sessão</button>
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
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', marginBottom: '4px' }}>{lead.name || lead.phone || 'Desconhecido'}</div>
                                    <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {lead.last_message || 'Nenhuma mensagem...'}
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



                {/* Right Column: Floating Island Area */}
                <div style={{ flex: 1, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selectedLead ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'var(--bg-secondary)',
                            borderRadius: '0',
                            borderLeft: '1px solid #E2E8F0',
                            boxShadow: 'none',
                            overflow: 'hidden',
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
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{selectedLead.name || selectedLead.phone || 'Desconhecido'}</div>
                                    <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: (presence[selectedLead.chat_id || selectedLead.phone || selectedLead.id] === 'composing' || presence[selectedLead.chat_id || selectedLead.phone || selectedLead.id] === 'available') ? '#22c55e' : '#cbd5e1'
                                        }} />
                                        {presence[selectedLead.chat_id || selectedLead.phone || selectedLead.id] === 'composing' ? 'Digitando...' :
                                            (presence[selectedLead.chat_id || selectedLead.phone || selectedLead.id] === 'available' ? 'Online' : 'Offline')}
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {
                                    messages.length > 0 ? messages.map((msg) => {
                                        return (
                                            <div key={msg.id} className="animate-slide-in" style={{
                                                alignSelf: msg.from_me ? 'flex-end' : 'flex-start',
                                                maxWidth: '65%',
                                                padding: '12px 18px',
                                                borderRadius: '18px', // Slightly softer radius
                                                // Softer Blue Gradient vs Light Gray
                                                background: msg.from_me ? 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)' : '#F9FAFB',
                                                color: msg.from_me ? '#ffffff' : '#1f2937', // Darker text for light bg
                                                fontSize: '14.5px',
                                                lineHeight: '22px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)', // Subtle shadow
                                                borderBottomRightRadius: msg.from_me ? '4px' : '18px',
                                                borderBottomLeftRadius: msg.from_me ? '18px' : '4px',
                                                position: 'relative',
                                                marginBottom: '6px',
                                                border: !msg.from_me ? '1px solid #F3F4F6' : 'none' // Subtle border for received
                                            }}>
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
                                                <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', textAlign: 'right', fontWeight: 500 }}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div style={{ textAlign: 'center', color: '#71717a', marginTop: '40px' }}>
                                            <p>Início da conversa</p>
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
                                        return null;
                                    })()
                                }
                                <div ref={messagesEndRef} />
                            </div >

                            {/* Input Area */}
                            <div style={{ padding: '0 20px', background: 'transparent', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 40 }}>
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
                                                placeholder="Digite uma mensagem..."
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                style={{
                                                    flex: 1,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#1E293B',
                                                    outline: 'none',
                                                    fontSize: '14px',
                                                    padding: '0 8px',
                                                    fontWeight: 400
                                                }}
                                            />

                                            {/* Mic / Send Inside Capsule */}
                                            <div
                                                onClick={inputValue.trim() ? handleSendMessage : handleStartRecording}
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    color: inputValue.trim() ? '#ffffff' : '#64748B',
                                                    background: inputValue.trim() ? 'var(--primary)' : 'transparent',
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
                            </div >
                        </div >
                    ) : (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-card)',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '24px',
                                background: 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)'
                            }}>
                                <MessageSquare size={32} />
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Nenhuma conversa selecionada</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Selecione um contato para começar a conversar</p>
                            </div>
                        </div>
                    )}
                </div >
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
        </div>
    );
};

export default ChatsPage;
