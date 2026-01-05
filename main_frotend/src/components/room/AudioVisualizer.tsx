'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function AudioVisualizer() {
  const [bars, setBars] = useState<number[]>(Array(40).fill(0));

  useEffect(() => {
    const interval = setInterval(() => {
      setBars(
        Array(40)
          .fill(0)
          .map(() => Math.random())
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-10">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-accent-gold to-accent-green rounded-full"
          animate={{ height: `${20 + height * 60}%` }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
