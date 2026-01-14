'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Music, MessageSquare, Settings, Users, Crown, QrCode, Volume2, Plus, Upload, Send } from 'lucide-react';
import { auth } from '@/lib/firebase';
import axios from 'axios';
import { QRModal } from './QRModal';



type TabType = 'session' | 'music' | 'chat';

interface Message {
  id: string;
  clientId?: string | null;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface ConnectedUser {
  userId: string;
  userName: string;
  userEmail: string;
  isAdmin: boolean;
}

export interface MobileRoomTabsProps {
  roomId: string;
  ws: WebSocket | null;
  onUploadComplete?: () => void;
  volume: number;
  setVolume: (v: number) => void;
}

export function MobileRoomTabs({ roomId, ws, onUploadComplete, volume, setVolume }: MobileRoomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('session');
  const [activePermission, setActivePermission] = useState<'everyone' | 'admins'>('admins');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenClientIdsRef = useRef<Set<string>>(new Set());
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Permission logic
  const currentUser = auth.currentUser;
  const isAdmin = connectedUsers.find(u => u.userId === currentUser?.uid)?.isAdmin;
  const canControlPlayback = activePermission === 'everyone' || isAdmin;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab !== 'chat') return;
    scrollToBottom();
  }, [messages, activeTab]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat') {
          const clientId = typeof data.clientId === 'string' ? data.clientId : null;
          if (clientId && seenClientIdsRef.current.has(clientId)) {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientId === clientId
                  ? {
                      id: data.id,
                      clientId,
                      userId: data.userId,
                      userName: data.userName,
                      content: data.content,
                      createdAt: data.createdAt,
                    }
                  : m
              )
            );
            return;
          }

          if (clientId) seenClientIdsRef.current.add(clientId);

          setMessages((prev) => [
            ...prev,
            {
              id: data.id,
              clientId,
              userId: data.userId,
              userName: data.userName,
              content: data.content,
              createdAt: data.createdAt,
            },
          ]);
        } else if (data.type === 'messageHistory') {
          const history: Message[] = Array.isArray(data.messages) ? data.messages : [];
          const nextSeen = new Set<string>();
          for (const m of history) {
            if (m?.clientId && typeof m.clientId === 'string') nextSeen.add(m.clientId);
          }
          seenClientIdsRef.current = nextSeen;
          setMessages(history);
        } else if (data.type === 'userJoined' || data.type === 'userLeft' || data.type === 'usersList') {
          if (data.users && Array.isArray(data.users)) {
            setConnectedUsers(data.users);
          }
        }
      } catch {
        // ignore
      }
    };

    const requestHistory = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'getMessages' }));
      ws.send(JSON.stringify({ type: 'getUsers' }));
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('open', requestHistory);
    requestHistory();

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('open', requestHistory);
    };
  }, [ws]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControlPlayback) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!file.type.startsWith('audio/')) return;
    if (file.type !== 'audio/mpeg' && file.type !== 'audio/mp3') return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
      const { data } = await axios.post(
        `${apiBase}/rooms/${roomId}/generate-upload`,
        { filename: file.name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await axios.put(data.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'trackUpdated' }));
      }
      onUploadComplete?.();
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      if (offset > 0 || velocity > 0) {
        if (activeTab === 'chat') setActiveTab('music');
        else if (activeTab === 'music') setActiveTab('session');
      } else {
        if (activeTab === 'session') setActiveTab('music');
        else if (activeTab === 'music') setActiveTab('chat');
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN) return;

    const user = auth.currentUser;
    if (!user) return;

    const clientId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    seenClientIdsRef.current.add(clientId);
    setMessages((prev) => [
      ...prev,
      {
        id: `client_${clientId}`,
        clientId,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);

    ws.send(
      JSON.stringify({
        type: 'chat',
        clientId,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        content: trimmed,
      })
    );

    setMessage('');
  };

  // Mobile browsers require user interaction to unlock AudioContext
  const unlockAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setAudioUnlocked(true);
  };

  // Setup Web Audio API chain on first user interaction
  useEffect(() => {
    if (!audioUnlocked) return;
    const audioEl = audioElementRef.current;
    if (!audioEl) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
    }
    if (!sourceNodeRef.current) {
      sourceNodeRef.current = ctx.createMediaElementSource(audioEl);
      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);
    }
    gainNodeRef.current.gain.value = volume / 100;
  }, [audioUnlocked, volume]);

  // Drag-to-set volume (touch/mouse/pointer)
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.round((x / rect.width) * 100);
      setVolume(Math.max(0, Math.min(100, percent)));
    };
    const onPointerUp = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
    };
    if (draggingRef.current) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('pointerleave', onPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
    };
  }, [draggingRef.current]);

  return (
    <div className="lg:hidden flex flex-col h-full bg-dark-900">
      <div className="flex items-center border-b border-white/10 bg-dark-900/95 backdrop-blur-sm sticky top-0 z-20">
        <motion.button
          onClick={() => setActiveTab('session')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'session' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className="w-4 h-4" />
          <span>Session</span>
          {activeTab === 'session' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </motion.button>

        <motion.button
          onClick={() => setActiveTab('music')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'music' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          <Music className="w-4 h-4" />
          <span>Music</span>
          {activeTab === 'music' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </motion.button>

        <motion.button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'chat' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
          {activeTab === 'chat' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </motion.button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overflow-y-auto"
          >
            {activeTab === 'session' && (
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-600 text-lg">#</span>
                    <span className="text-zinc-100 font-semibold text-lg">Room {roomId}</span>
                  </div>
                  <motion.button
                    onClick={() => setIsQRModalOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </motion.button>
                </div>
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-zinc-500 mb-3 tracking-wider uppercase">
                    <span>Playback Permissions</span>
                  </div>

                  <div className="relative glass rounded-xl p-1">
                    <motion.div
                      className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-gradient-to-br from-accent-gold to-amber-600 rounded-lg"
                      animate={{
                        x: activePermission === 'everyone' ? 0 : 'calc(100% + 0.25rem)',
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />

                    <div className="relative grid grid-cols-2 gap-1">
                      <motion.button
                        onClick={() => isAdmin && setActivePermission('everyone')}
                        className={`relative z-10 flex items-center justify-center space-x-2 py-3 text-sm rounded-lg transition-colors ${
                          activePermission === 'everyone' ? 'text-black font-semibold' : 'text-zinc-400'
                        } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        whileTap={{ scale: 0.98 }}
                        disabled={!isAdmin}
                      >
                        <Users className="w-4 h-4" />
                        <span>Everyone</span>
                      </motion.button>

                      <motion.button
                        onClick={() => isAdmin && setActivePermission('admins')}
                        className={`relative z-10 flex items-center justify-center space-x-2 py-3 text-sm rounded-lg transition-colors ${
                          activePermission === 'admins' ? 'text-black font-semibold' : 'text-zinc-400'
                        } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        whileTap={{ scale: 0.98 }}
                        disabled={!isAdmin}
                      >
                        <Crown className="w-4 h-4" />
                        <span>Admins</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-3 tracking-wider uppercase">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Global Volume</span>
                    </div>
                    <span className="text-zinc-400">{volume}%</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                    <div
                      ref={volumeBarRef}
                      className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden cursor-pointer"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        unlockAudio(); // Unlock AudioContext on first interaction (required for mobile)
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percent = Math.round((x / rect.width) * 100);
                        setVolume(Math.max(0, Math.min(100, percent)));
                        draggingRef.current = true;
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        unlockAudio(); // Unlock AudioContext on first interaction (required for mobile)
                        if (!volumeBarRef.current) return;
                        const rect = volumeBarRef.current.getBoundingClientRect();
                        const touch = e.touches[0];
                        const x = touch.clientX - rect.left;
                        const percent = Math.round((x / rect.width) * 100);
                        setVolume(Math.max(0, Math.min(100, percent)));
                        draggingRef.current = true;
                      }}
                    >
                      <motion.div
                        className="h-full bg-zinc-100 rounded-full"
                        style={{ width: `${volume}%` }}
                        whileHover={{ boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)' }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-3 tracking-wider uppercase">
                    <div className="flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>Connected Users</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full text-xs font-semibold">
                        {connectedUsers.length}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {connectedUsers.map((user) => {
                      const isCurrentUser = user.userId === auth.currentUser?.uid;
                      return (
                        <motion.div
                          key={user.userId}
                          className="glass rounded-xl p-3 border border-white/10"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                  {user.userName?.slice(0, 2).toUpperCase() || 'U'}
                                </div>
                                {user.isAdmin && (
                                  <div className="absolute -top-1 -right-1 bg-accent-gold rounded-full p-1 border-2 border-dark-900 shadow-lg">
                                    <Crown className="w-2.5 h-2.5 text-black" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-zinc-100">
                                  {user.userName || 'Anonymous'}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {user.isAdmin ? 'Admin' : 'Member'}
                                </div>
                              </div>
                            </div>
                            {isCurrentUser && (
                              <div className="bg-emerald-500/20 text-emerald-500 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                                You
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wider">
                    Tips
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2.5 text-xs text-zinc-400">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-gold flex-shrink-0" />
                      <span>Play on speaker directly. Don't use Bluetooth for best sync.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'music' && (
              <div className="p-4 space-y-6">
                <motion.label
                  htmlFor="audio-upload-mobile"
                  className="w-full glass rounded-xl p-4 flex items-center space-x-3 group border border-white/10 hover:border-accent-gold/50 transition-all cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold-light flex items-center justify-center text-black shadow-lg">
                    {isUploading ? <Upload className="w-6 h-6 animate-bounce" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold text-zinc-100">
                      {isUploading ? `Uploading ${uploadProgress}%` : 'Upload audio'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {isUploading ? 'Please wait...' : 'Add music to queue'}
                    </div>
                    {selectedFile && (
                              <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                              <p className="text-xs text-zinc-400 truncate max-w-[200px]">
                    {selectedFile.name.length > 30 
                      ? `${selectedFile.name.slice(0, 27)}...` 
                      : selectedFile.name}
                                </p>
                    </div>
              )}
                  </div>
                  <input
                    id="audio-upload-mobile"
                    type="file"
                    accept="audio/mp3,audio/mpeg,.mp3"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading || !canControlPlayback}
                  />
                </motion.label>

                {isUploading && (
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-accent-gold to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wider">
                    Queue
                  </h3>
                  <div className="glass rounded-xl p-8 text-center border border-white/10">
                    <Music className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-zinc-400 mb-1">
                      No tracks yet
                    </h3>
                    <p className="text-zinc-600 text-xs">
                      Upload your first track to get started
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 rounded-2xl glass border border-white/10 flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-zinc-700" />
                      </div>
                      <h3 className="text-zinc-300 font-semibold text-base mb-2">
                        No messages yet
                      </h3>
                      <p className="text-zinc-600 text-sm max-w-xs">
                        Start the conversation with other listeners
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg, index) => {
                        const isCurrentUser = msg.userId === auth.currentUser?.uid;
                        const showAvatar = index === 0 || messages[index - 1].userId !== msg.userId;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex items-start space-x-2 max-w-[85%] ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              {showAvatar && !isCurrentUser && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {msg.userName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              {!showAvatar && !isCurrentUser && <div className="w-8" />}

                              <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                {showAvatar && (
                                  <span className="text-xs text-zinc-500 mb-1 px-3">
                                    {isCurrentUser ? 'You' : msg.userName}
                                  </span>
                                )}
                                <div
                                  className={`px-4 py-2 rounded-2xl ${
                                    isCurrentUser ? 'bg-accent-gold text-white' : 'glass border border-white/10 text-white'
                                  }`}
                                >
                                  <p className="text-sm break-words">{msg.content}</p>
                                </div>
                                <span className="text-[10px] text-zinc-600 mt-1 px-3">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-white/5 bg-dark-900/95 backdrop-blur-sm">
                  <form onSubmit={handleSendMessage} className="relative group">
                    <input
                      type="text"
                      placeholder="Message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full glass rounded-full px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-accent-gold/50 transition-all pr-12"
                    />
                    <motion.button
                      type="submit"
                      disabled={!message.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent-gold/20 text-accent-gold flex items-center justify-center hover:bg-accent-gold hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={{ scale: message.trim() ? 1.1 : 1 }}
                      whileTap={{ scale: message.trim() ? 0.9 : 1 }}
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} roomId={roomId} />
    </div>
  );
}
