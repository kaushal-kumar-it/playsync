'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/room/TopBar';
import { LeftSidebar } from '@/components/room/LeftSidebar';
import { CenterPanel } from '@/components/room/CenterPanel';
import { RightSidebar } from '@/components/room/RightSidebar';
import { PlayerControls } from '@/components/room/PlayerControls';
import { MobileRoomTabs } from '@/components/room/MobileRoomTabs';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

let pendingWsClose: Promise<void> | null = null;

function waitForWsClose(ws: WebSocket, timeoutMs = 300) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ws.removeEventListener('close', onClose);
      resolve();
    };
    const onClose = () => finish();

    ws.addEventListener('close', onClose);
    setTimeout(finish, timeoutMs);
  });
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = React.use(params);
  const wsRef = useRef<WebSocket | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectingRef = useRef(false);
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    let cancelled = false;

    if (!authReady) return;
    if (!authUser) {
      router.push('/');
      return;
    }

    (async () => {
      if (pendingWsClose) await pendingWsClose;
      if (cancelled) return;

      if (connectingRef.current) {
        return;
      }
      
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      connectingRef.current = true;
      
      console.log(`🔌 Attempting to connect to room ${roomId}...`);

      const token = await authUser.getIdToken();
      const websocket = new WebSocket(
        `ws://localhost:4000?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
      );
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
    })();

    return () => {
      cancelled = true;
      const current = wsRef.current;
      if (
        current &&
        (current.readyState === WebSocket.OPEN ||
          current.readyState === WebSocket.CONNECTING)
      ) {
        pendingWsClose = waitForWsClose(current);
        console.log(`🔌 Closing WebSocket connection for room ${roomId}`);
        current.close();
      }
      wsRef.current = null;
      setWs(null);
      connectingRef.current = false;
    };
  }, [roomId, authReady, authUser, router]);
  
  return (
    <div className="h-screen w-full bg-black text-zinc-100 flex flex-col overflow-hidden font-sans">
      <TopBar roomId={roomId} />

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <LeftSidebar roomId={roomId} />
        <CenterPanel roomId={roomId} />
        <RightSidebar roomId={roomId} ws={ws} />
      </div>

      <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
        <MobileRoomTabs roomId={roomId} />
      </div>

      <PlayerControls />
    </div>
  );
}
