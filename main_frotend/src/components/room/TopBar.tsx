'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Users, Github, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TopBar({ roomId }: { roomId: string }) {
  const router = useRouter();
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_LINK;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-12 sm:h-14 glass-dark border-b border-white/5 flex items-center justify-between px-3 sm:px-6 select-none relative z-40"
    >
      <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-8">
        <motion.div
          className="flex items-center space-x-1.5 sm:space-x-2.5 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          onClick={() => router.push('/dashboard')}
        >
          <div className="relative">
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-accent-gold" />
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-accent-gold-light blur-sm" />
            </motion.div>
          </div>
          <span className="text-zinc-100 font-bold text-sm sm:text-lg tracking-tight">
            Beatsync
          </span>
        </motion.div>
        <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6 text-xs font-medium">
          <motion.div
            className="hidden sm:flex items-center space-x-2 text-accent-green"
            whileHover={{ scale: 1.05 }}
          >
            <motion.div
              className="relative w-2 h-2"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="absolute inset-0 rounded-full bg-accent-green" />
              <div className="absolute inset-0 rounded-full bg-accent-green animate-ping" />
            </motion.div>
            <span className="font-semibold">Connected</span>
          </motion.div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 text-zinc-400">
            <span className="text-zinc-600">#</span>
            <span className="font-mono text-xs sm:text-sm">{roomId}</span>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-zinc-500">
            <Users className="w-3.5 h-3.5" />
            <span>1 user</span>
          </div>
        </div>

        <div className="hidden lg:block h-4 w-px bg-white/10" />
        <div className="hidden lg:flex items-center space-x-6 text-xs text-zinc-500 font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="text-zinc-600">Offset:</span>
            <span className="text-accent-green">0ms</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-zinc-600">RTT:</span>
            <span className="text-accent-green">0ms</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-2">
        <motion.button
          className="p-2 sm:p-2 text-zinc-500 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors touch-manipulation"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageCircle className="w-5 h-5 sm:w-5 sm:h-5" />
        </motion.button>
        {githubUrl ? (
          <motion.a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:block p-2 sm:p-2 text-zinc-500 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors touch-manipulation"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open GitHub repository"
            title="GitHub"
          >
            <Github className="w-5 h-5 sm:w-5 sm:h-5" />
          </motion.a>
        ) : null}
      </div>
    </motion.header>
  );
}
