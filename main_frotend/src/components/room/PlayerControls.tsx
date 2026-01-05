'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';

export function PlayerControls() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [progress, setProgress] = useState(0);

  return (
    <motion.footer
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="h-20 sm:h-22 glass-dark border-t border-white/5 flex items-center justify-between px-3 sm:px-6 lg:px-8 relative z-30"
    >
      <div className="hidden sm:flex w-1/4 items-center space-x-4">
        <span className="text-zinc-500 text-sm font-mono tabular-nums">00:00</span>
      </div>
      <div className="flex-1 flex flex-col items-center max-w-2xl">
        <div className="flex items-center space-x-3 sm:space-x-6 mb-2 sm:mb-3">
          <motion.button
            className="hidden sm:block text-zinc-500 hover:text-zinc-100 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          <motion.button
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-2 sm:p-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipBack className="w-6 h-6 sm:w-6 sm:h-6 fill-current" />
          </motion.button>

          <motion.button
            className="relative group"
            onClick={() => setIsPlaying(!isPlaying)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-white rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-2xl">
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-5 sm:h-5 text-black fill-current" />
              ) : (
                <Play className="w-5 h-5 sm:w-5 sm:h-5 text-black fill-current ml-0.5" />
              )}
            </div>
          </motion.button>

          <motion.button
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-2 sm:p-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipForward className="w-6 h-6 sm:w-6 sm:h-6 fill-current" />
          </motion.button>

          <motion.button
            className="hidden sm:block text-accent-green hover:text-accent-green-light transition-colors relative"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-green"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        </div>
        <div className="w-full flex items-center space-x-2 sm:space-x-3 group cursor-pointer">
          <div
            className="flex-1 h-2 sm:h-1.5 bg-white/5 rounded-full overflow-hidden group-hover:h-2.5 sm:group-hover:h-2 transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x / rect.width) * 100;
              setProgress(percentage);
            }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-accent-gold to-accent-green rounded-full relative"
              style={{ width: `${progress}%` }}
              whileHover={{ boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)' }}
            >
              <motion.div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                whileHover={{ scale: 1.2 }}
              />
            </motion.div>
          </div>
        </div>
      </div>
      <div className="hidden sm:flex w-1/4 items-center justify-end space-x-3">
        <div className="flex items-center space-x-3 w-36 group">
          <motion.button
            onClick={() => setVolume(volume > 0 ? 0 : 75)}
            className="p-1"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {volume > 0 ? (
              <Volume2 className="w-5 h-5 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
            ) : (
              <VolumeX className="w-5 h-5 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
            )}
          </motion.button>

          <div
            className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer group-hover:h-2 transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x / rect.width) * 100;
              setVolume(percentage);
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
    </motion.footer>
  );
}
