'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';

export function CenterPanel({ roomId }: { roomId: string }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex-1 bg-gradient-to-b from-dark-900 to-dark-950 flex flex-col relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-green/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-gold/20 to-accent-green/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative glass rounded-xl sm:rounded-2xl border border-white/10 group-focus-within:border-accent-gold/50 transition-all duration-300 touch-none">
              <div className="flex items-center px-3 py-3 sm:px-5 sm:py-4">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="What do you want to play?"
                  className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-sm sm:text-base min-w-0"
                />
                <kbd className="hidden sm:block ml-3 px-2 py-1 text-xs font-mono text-zinc-500 bg-white/5 border border-white/10 rounded">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mt-4 flex items-center space-x-2 text-[10px] font-mono text-zinc-600 uppercase tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Sparkles className="w-3 h-3" />
          <span>[Experimental Free Beta]</span>
        </motion.div>
      </div>
      <div className="relative flex-1 flex flex-col items-center justify-center -mt-16">
        <AudioVisualizer />

        <motion.div
          className="relative z-10 text-center space-y-8"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <div className="space-y-3">
            <motion.div
              className="w-20 h-20 mx-auto rounded-2xl glass border border-white/10 flex items-center justify-center"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="text-4xl">🎵</div>
            </motion.div>
            <h2 className="text-zinc-400 text-xl font-medium">No tracks yet</h2>
            <p className="text-zinc-600 text-sm">Upload music to start the session</p>
          </div>
        </motion.div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent pointer-events-none" />
    </motion.main>
  );
}
