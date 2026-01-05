'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export function QRModal({ isOpen, onClose, roomId }: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const roomUrl = `${baseUrl}/room/${roomId}`;
      
      QRCode.toCanvas(
        canvasRef.current,
        roomUrl,
        {
          width: 300,
          margin: 2,
          color: {
            dark: '#FFFFFF',
            light: '#1a1a1a',
          },
        },
        (error) => {
          if (error) console.error('QR Code generation error:', error);
        }
      );
    }
  }, [isOpen, roomId]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const url = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `beatsync-room-${roomId}.png`;
    link.href = url;
    link.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-dark border border-white/10 rounded-2xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">Join Room QR Code</h2>
                  <p className="text-sm text-zinc-500 mt-1">Scan to join Room {roomId}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-6 relative">
                <motion.button
                  onClick={onClose}
                  className="absolute -top-3 -right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-100 hover:text-white transition-colors border border-white/20 shadow-lg z-10"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
                <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/10">
                  <canvas ref={canvasRef} />
                </div>
              </div>

              {/* Room URL */}
              <div className="mb-6">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                  Room URL
                </label>
                <div className="glass rounded-lg p-3 flex items-center justify-between">
                  <code className="text-sm text-zinc-300 truncate">
                    {typeof window !== 'undefined' && `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/room/${roomId}`}
                  </code>
                  <motion.button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                        navigator.clipboard.writeText(`${baseUrl}/room/${roomId}`);
                      }
                    }}
                    className="ml-2 px-3 py-1 text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 rounded-md transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Copy
                  </motion.button>
                </div>
              </div>

              {/* Download Button */}
              <motion.button
                onClick={handleDownload}
                className="w-full bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg hover:shadow-amber-500/20 transition-shadow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Download className="w-5 h-5" />
                <span>Download QR Code</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
