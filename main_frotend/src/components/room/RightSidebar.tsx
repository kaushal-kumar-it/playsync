'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface RightSidebarProps {
  roomId: string;
  ws: WebSocket | null;
}

export function RightSidebar({ roomId, ws }: RightSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'chat') {
        setMessages(prev => [...prev, {
          id: data.id,
          userId: data.userId,
          userName: data.userName,
          content: data.content,
          createdAt: data.createdAt
        }]);
      } else if (data.type === 'messageHistory') {
        setMessages(data.messages);
      }
    };

    ws.addEventListener('message', handleMessage);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getMessages' }));
    }

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    const user = auth.currentUser;
    if (!user) return;

    ws.send(JSON.stringify({
      type: 'chat',
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      content: newMessage.trim()
    }));

    setNewMessage('');
  };

  return (
    <motion.aside
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="hidden lg:flex w-80 xl:w-96 glass-dark border-l border-white/5 flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="relative p-4 border-b border-white/5">
        <div className="flex items-center space-x-2 text-sm font-medium text-zinc-100">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <span>Chat</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <motion.div
              className="w-20 h-20 rounded-2xl glass border border-white/10 flex items-center justify-center mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MessageSquare className="w-10 h-10 text-zinc-700" />
            </motion.div>

            <h3 className="text-zinc-300 font-semibold text-lg mb-2">No messages yet</h3>
            <p className="text-zinc-600 text-sm max-w-xs">
              Start the conversation with other listeners
            </p>
          </motion.div>
        ) : (
          <>
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
                  <div className={`flex items-start space-x-2 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
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
                          isCurrentUser
                            ? 'bg-accent-gold text-black'
                            : 'glass border border-white/10 text-white'
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
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <form onSubmit={handleSendMessage} className="relative group">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message"
            className="w-full glass rounded-full px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none border border-white/10 focus:border-accent-gold/50 transition-all pr-12"
          />
          <motion.button
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent-gold/20 text-accent-gold flex items-center justify-center hover:bg-accent-gold hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: newMessage.trim() ? 1.1 : 1 }}
            whileTap={{ scale: newMessage.trim() ? 0.9 : 1 }}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
      </div>
    </motion.aside>
  );
}
