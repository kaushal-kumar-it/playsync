'use client';

import React from 'react';
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

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PlayerControls({
  hasTrack,
  trackName,
  isPlaying,
  volume,
  progress,
  currentTime,
  duration,
  isShuffle,
  isRepeat,
  onTogglePlay,
  onSeek,
  onSkipBack,
  onSkipForward,
  onToggleMute,
  onSetVolume,
  onToggleShuffle,
  onToggleRepeat,
}: {
  hasTrack: boolean;
  trackName: string | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  isRepeat: boolean;
  onTogglePlay: () => void;
  onSeek: (percentage: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onToggleMute: () => void;
  onSetVolume: (percentage: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}) {
  const percentFromClientX = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) return 0;
    const x = clientX - rect.left;
    return Math.min(100, Math.max(0, (x / rect.width) * 100));
  };

  // Drag-to-set volume (touch/mouse)
  const volumeBarRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    if (!draggingRef.current) return;
    const onPointerMove = (e: PointerEvent) => {
      if (!volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      onSetVolume(percentFromClientX(e.clientX, rect));
    };
    const onPointerUp = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onSetVolume]);

  return (
    <motion.footer
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="h-24 sm:h-22 glass-dark border-t border-white/5 flex items-center justify-between px-3 sm:px-6 lg:px-8 relative z-30"
    >
      {/* Desktop: Track Info */}
      <div className="hidden sm:flex w-1/4 items-center space-x-4">
        <div className="min-w-0">
          <div className="text-zinc-300 text-sm font-medium truncate">
            {trackName || (hasTrack ? 'Track' : 'No track')}
          </div>
          <div className="text-zinc-500 text-sm font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex-1 flex flex-col items-center max-w-2xl">
        {/* Mobile: Track Info */}
        <div className="sm:hidden w-full text-center mb-3 px-2">
          <div className="text-zinc-300 text-xs font-medium truncate">
            {trackName || (hasTrack ? 'Track' : 'No track')}
          </div>
          <div className="text-zinc-500 text-xs font-mono tabular-nums mt-0.5">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center space-x-3 sm:space-x-6 mb-3">
          <motion.button
            className={`hidden sm:block transition-colors ${
              isShuffle ? 'text-accent-gold' : 'text-zinc-500 hover:text-zinc-100'
            }`}
            onClick={onToggleShuffle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>

          <motion.button
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-2 sm:p-0"
            onClick={onSkipBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipBack className="w-6 h-6 sm:w-6 sm:h-6 fill-current" />
          </motion.button>

          <motion.button
            className="relative group"
            onClick={onTogglePlay}
            disabled={!hasTrack}
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
            onClick={onSkipForward}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <SkipForward className="w-6 h-6 sm:w-6 sm:h-6 fill-current" />
          </motion.button>

          <motion.button
            className={`hidden sm:block transition-colors relative ${
              isRepeat ? 'text-accent-green' : 'text-zinc-500 hover:text-zinc-100'
            }`}
            onClick={onToggleRepeat}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
            {isRepeat && (
              <motion.div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-green"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.button>
        </div>

        {/* Playback Timeline - Both Mobile and Desktop */}
        <div className="w-full flex items-center space-x-2 sm:space-x-3 group cursor-pointer px-2 sm:px-0">
          <div
            className="flex-1 h-2 sm:h-1.5 bg-white/5 rounded-full overflow-hidden group-hover:h-2.5 sm:group-hover:h-2 transition-all"
            onPointerDown={(e) => {
              if (!hasTrack || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek(percentFromClientX(e.clientX, rect));
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-accent-gold to-accent-green rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-accent-gold shadow-lg z-10"
                style={{ boxShadow: '0 0 8px 2px rgba(251,191,36,0.18), 0 2px 8px rgba(0,0,0,0.12)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Volume Control */}
      <div className="hidden sm:flex w-1/4 items-center justify-end space-x-3">
        <div className="flex items-center space-x-3 w-36 group">
          <motion.button
            onClick={onToggleMute}
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
            ref={volumeBarRef}
            className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer group-hover:h-2 transition-all"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSetVolume(percentFromClientX(e.clientX, rect));
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
    </motion.footer>
  );
}