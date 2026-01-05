'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/room/TopBar';
import { LeftSidebar } from '@/components/room/LeftSidebar';
import { CenterPanel } from '@/components/room/CenterPanel';
import { RightSidebar } from '@/components/room/RightSidebar';
import { PlayerControls } from '@/components/room/PlayerControls';
import { MobileRoomTabs } from '@/components/room/MobileRoomTabs';
import { useRouter } from 'next/navigation';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = React.use(params);
  const wsRef = useRef<WebSocket | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectingRef = useRef(false); // Prevent duplicate connections
  const router = useRouter();
  
  useEffect(() => {
    // Prevent duplicate connections in strict mode
    if (connectingRef.current) {
      console.log('⚠️ Already connecting, skipping duplicate');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('⚠️ WebSocket already connected or connecting, skipping');
      return;
    }

    connectingRef.current = true;
    
    // Connect to WebSocket
    console.log(`🔌 Attempting to connect to room ${roomId}...`);
    const websocket = new WebSocket(`ws://localhost:4000?roomId=${roomId}`);
    wsRef.current = websocket;

    websocket.onopen = () => {
      console.log(`✅ Connected to room ${roomId}`);
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
      connectingRef.current = false;
    };

    websocket.onclose = () => {
      console.log(`👋 Disconnected from room ${roomId}`);
      setIsConnected(false);
      setWs(null);
      connectingRef.current = false;
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log(`🔌 Closing WebSocket connection for room ${roomId}`);
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
      }
      connectingRef.current = false;
    };
  }, [roomId]);
  
  return (
    <div className="h-screen w-full bg-black text-zinc-100 flex flex-col overflow-hidden font-sans">
      <TopBar roomId={roomId} />

      {/* Desktop View */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <LeftSidebar roomId={roomId} />
        <CenterPanel roomId={roomId} />
        <RightSidebar roomId={roomId} ws={ws} />
      </div>

      {/* Mobile View */}
      <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
        <MobileRoomTabs roomId={roomId} />
      </div>

      <PlayerControls />
    </div>
  );
}
