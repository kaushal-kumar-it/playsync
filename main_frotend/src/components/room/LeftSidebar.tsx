'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Users, Crown, ChevronRight, Plus, Upload } from 'lucide-react';
import { auth } from '@/lib/firebase';
import axios from 'axios';
import { QRModal } from './QRModal';

interface ConnectedUser {
  userId: string;
  userName: string;
  userEmail: string;
  isAdmin: boolean;
}

interface LeftSidebarProps {
  roomId: string;
  ws?: WebSocket | null;
  onUploadComplete?: () => void;
}

export function LeftSidebar({ roomId, ws, onUploadComplete }: LeftSidebarProps) {
  const [activePermission, setActivePermission] = useState<'everyone' | 'admins'>('admins');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'userJoined' || data.type === 'userLeft' || data.type === 'usersList') {
          if (data.users && Array.isArray(data.users)) {
            setConnectedUsers(data.users);
          }
        }
      } catch {
        // ignore
      }
    };

    const requestUsers = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'getUsers' }));
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('open', requestUsers);
    requestUsers();

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('open', requestUsers);
    };
  }, [ws]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="hidden lg:flex w-80 glass-dark border-r border-white/5 flex-col overflow-hidden"
    >
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="text-zinc-600 text-lg">#</span>
          <span className="text-zinc-100 font-semibold text-lg">Room {roomId}</span>
        </div>
        <motion.button
          onClick={() => setIsQRModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>QR</span>
        </motion.button>
      </div>

      <div className="p-5">
        <div className="flex items-center space-x-2 text-[10px] font-bold text-zinc-600 mb-3 tracking-widest uppercase">
          <ChevronRight className="w-3 h-3" />
          <span>Playback Permissions</span>
        </div>

        <div className="relative glass rounded-xl p-1">
          <motion.div
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg"
            animate={{
              x: activePermission === 'everyone' ? 0 : 'calc(100% + 0.25rem)',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />

          <div className="relative grid grid-cols-2 gap-1">
            <motion.button
              onClick={() => setActivePermission('everyone')}
              className={`relative z-10 flex items-center justify-center space-x-2 py-2.5 text-sm rounded-lg transition-colors ${
                activePermission === 'everyone' ? 'text-black font-semibold' : 'text-zinc-400'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <Users className="w-4 h-4" />
              <span>Everyone</span>
            </motion.button>

            <motion.button
              onClick={() => setActivePermission('admins')}
              className={`relative z-10 flex items-center justify-center space-x-2 py-2.5 text-sm rounded-lg transition-colors ${
                activePermission === 'admins' ? 'text-black font-semibold' : 'text-zinc-400'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <Crown className="w-4 h-4" />
              <span>Admins</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
        <div className="px-5 py-3 flex items-center justify-between text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
          <div className="flex items-center space-x-2">
            <Users className="w-3 h-3" />
            <span>Connected Users</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              {connectedUsers.length}
            </span>
          </div>
        </div>

        <motion.div
          className="px-3 mt-2 pb-4 space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {connectedUsers.map((user, index) => {
            const isCurrentUser = user.userId === auth.currentUser?.uid;
            return (
              <motion.div
                key={user.userId}
                className="glass rounded-xl p-3 border border-white/10"
                whileHover={{ scale: 1.02, borderColor: 'rgba(251, 191, 36, 0.3)' }}
                transition={{ type: 'spring', stiffness: 400 }}
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
                        <motion.div
                          className="absolute -top-1 -right-1 bg-accent-gold rounded-full p-1 border-2 border-dark-900 shadow-lg"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <Crown className="w-2.5 h-2.5 text-black" />
                        </motion.div>
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
                    <div className="bg-accent-green/20 text-accent-green text-xs font-bold px-2.5 py-1 rounded-full border border-accent-green/30">
                      You
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="flex-shrink-0 p-3 border-t border-white/10 space-y-2 bg-black/20">

        <motion.label
          htmlFor="audio-upload"
          className="w-full glass rounded-xl p-3 flex items-center space-x-3 group border border-white/10 hover:border-accent-gold/50 transition-all cursor-pointer"
          whileHover={{ scale: 1.01, boxShadow: '0 0 20px rgba(251, 191, 36, 0.2)' }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold-light flex items-center justify-center text-black shadow-lg group-hover:shadow-accent-gold/50 transition-shadow">
            {isUploading ? <Upload className="w-5 h-5 animate-bounce" /> : <Plus className="w-5 h-5" />}
          </div>
          <div className="text-left flex-1">
            <div className="text-[13px] font-semibold text-zinc-100">
              {isUploading ? `Uploading ${uploadProgress}%` : 'Upload audio'}
            </div>
            <div className="text-[11px] text-zinc-500">
              {isUploading ? 'Please wait...' : 'Add music to room'}
            </div>
            {selectedFile && (
              <div className="text-[11px] text-zinc-400 mt-1">
                {(() => {
                  const name = selectedFile.name;
                  const ext = name.endsWith('.mp3') ? '.mp3' : '';
                  const base = ext ? name.slice(0, -4) : name;
                  return base.length > 14
                    ? `${base.slice(0, 14)}...${ext}`
                    : name;
                })()}
              </div>
            )}
          </div>
          <input
            id="audio-upload"
            type="file"
            accept="audio/mp3,audio/mpeg,.mp3"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </motion.label>

        {isUploading && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-gold to-accent-green"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} roomId={roomId} />
    </motion.aside>
  );
}