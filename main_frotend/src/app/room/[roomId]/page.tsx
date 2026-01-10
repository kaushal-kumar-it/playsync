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
import axios from 'axios';
import { SyncClient } from '@/lib/syncClient';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectingRef = useRef(false);
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const syncRef = useRef<any>(null);
  const [globalTime, setGlobalTime] = useState<number>(0);

  const [offset, setOffset] = useState<number>(0);
  const [rtt, setRtt] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(globalTime);
      if (syncRef.current) {
        setRtt(Math.round((syncRef.current.lastRTT || 0) * 1000));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [globalTime]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const refreshPlaybackUrl = React.useCallback(async () => {
    if (!authUser) return;
    try {
      const token = await authUser.getIdToken();
      const { data } = await axios.get(
        `http://localhost:4000/rooms/${roomId}/playback-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const nextUrl = typeof data?.playbackUrl === 'string' ? data.playbackUrl : null;
      const objectName = typeof data?.objectName === 'string' ? data.objectName : '';
      const withoutLeadingTs = objectName.replace(/^\d+_/, '');
      const withoutRoomPrefix = withoutLeadingTs.replace(new RegExp(`^room-${roomId}-\\d+_`), '');
      const displayName = withoutRoomPrefix || withoutLeadingTs || objectName;
      setAudioUrl(nextUrl);
      setTrackName(displayName || null);
    } catch {
      setAudioUrl(null);
      setTrackName(null);
    }
  }, [authUser, roomId]);

  useEffect(() => {
    if (!authReady || !authUser) return;
    refreshPlaybackUrl();
  }, [authReady, authUser, refreshPlaybackUrl]);
  
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

      const token = await authUser.getIdToken();
      const websocket = new WebSocket(
        `ws://localhost:4000?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`
      );
      wsRef.current = websocket;

      websocket.onopen = () => {
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onerror = () => {
        setIsConnected(false);
        connectingRef.current = false;
      };

      websocket.onclose = () => {
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
        current.close();
      }
      wsRef.current = null;
      setWs(null);
      connectingRef.current = false;
    };
  }, [roomId, authReady, authUser, router]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      const t = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setDuration(d);
      setCurrentTime(t);
      setProgress(d > 0 ? (t / d) * 100 : 0);
    };

    const onEnded = () => {
      if (isRepeat && audio.src) {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [isRepeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, volume / 100));
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioUrl) {
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== audioUrl) {
      audio.src = audioUrl;
      audio.load();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'trackUpdated') {
          refreshPlaybackUrl();
        }
      } catch {
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, refreshPlaybackUrl]);

  // --- Time Sync Setup ---
  useEffect(() => {
    if (!ws) return;
    const getTime = () => performance.now() / 1000;
    const sync = new SyncClient(getTime);
    syncRef.current = sync;
    const sendFunction = (pingId: number, clientPingTime: number) => {
      ws.send(JSON.stringify([0, pingId, clientPingTime]));
    };
    const receiveFunction = (callback: Function) => {
      ws.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (Array.isArray(msg) && msg[0] === 1) {
            callback(msg[1], msg[2], msg[3], msg[4]);
          }
        } catch {}
      });
    };
    sync.start(sendFunction, receiveFunction, (status: any) => {
      // Optionally update UI with sync status
    });
    return () => sync.stop();
  }, [ws]);

  // Global Time UI 
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sync = syncRef.current;
      if (sync && typeof sync.getSyncTime === 'function') {
        setGlobalTime(sync.getSyncTime()%1e6);
      } else {
        setGlobalTime(performance.now() / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scheduled Play/Pause 
  useEffect(() => {
    if (!ws) return;
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const sync = syncRef.current;
        const audio = audioRef.current;
        if (!audio || !sync?.getSyncTime) return;
        if (data.type === 'play') {
          const now = sync.getSyncTime();
          const delay = Math.max(0, (data.executeAt - now) * 1000);
          if (typeof data.currentTime === 'number') {
            audio.currentTime = data.currentTime;
          }
          setTimeout(() => {
            audio.play().catch(() => setIsPlaying(false));
          }, delay);
        }
        if (data.type === 'pause') {
          const now = sync.getSyncTime();
          const delay = Math.max(0, (data.executeAt - now) * 1000);
          setTimeout(() => {
            if (typeof data.currentTime === 'number') {
              audio.currentTime = data.currentTime;
            }
            audio.pause();
          }, delay);
        }
      } catch {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  //  Play/Pause Request (Sync)
  const playSync = () => {
    const socket = wsRef.current;
    const sync = syncRef.current;
    const audio = audioRef.current;
    if (!socket || !sync || !audio) return;
    const now = sync.getSyncTime();
    const nextMark = Math.ceil(now / 2) * 2;
    const executeAt = nextMark;
    const currentTime = audio.currentTime || 0;
    socket.send(JSON.stringify({ type: 'play', executeAt, currentTime }));
  };
  const pauseSync = () => {
    const socket = wsRef.current;
    const sync = syncRef.current;
    const audio = audioRef.current;
    if (!socket || !sync || !audio) return;
    const now = sync.getSyncTime();
    const nextMark = Math.ceil(now / 2) * 2;
    const executeAt = nextMark;
    const currentTime = audio.currentTime || 0;
    socket.send(JSON.stringify({ type: 'pause', executeAt, currentTime }));
  };

  const hasTrack = Boolean(audioUrl);

  //  Play/Pause Request (Sync)
  const onTogglePlay = async () => {
    const socket = wsRef.current;
    const sync = syncRef.current;
    const audio = audioRef.current;
    if (!socket || !sync || !audio) return;
    const now = sync.getSyncTime();
    const nextMark = Math.ceil(now / 2) * 2;
    const executeAt = nextMark;
    const currentTime = audio.currentTime || 0;
    if (audio.paused) {
      socket.send(JSON.stringify({ type: 'play', executeAt, currentTime }));
    } else {
      socket.send(JSON.stringify({ type: 'pause', executeAt, currentTime }));
    }
  };

  const onSeek = (percentage: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (d <= 0) return;
    audio.currentTime = (Math.min(100, Math.max(0, percentage)) / 100) * d;
  };

  const onSkipBack = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const onSkipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = d > 0 ? Math.min(d, audio.currentTime + 10) : audio.currentTime + 10;
  };

  const onToggleMute = () => {
    setVolume((v) => (v > 0 ? 0 : 75));
  };

  const onSetVolume = (percentage: number) => {
    setVolume(Math.min(100, Math.max(0, percentage)));
  };

  const onToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const onToggleRepeat = () => {
    setIsRepeat((prev) => !prev);
  };
  
  return (
    <div className="h-screen w-full bg-black text-zinc-100 flex flex-col overflow-hidden font-sans">
      <TopBar roomId={roomId} offset={offset} rtt={rtt} />

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" className="hidden" />

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <LeftSidebar roomId={roomId} ws={ws} onUploadComplete={refreshPlaybackUrl} />
        <CenterPanel roomId={roomId} hasTrack={hasTrack} />
        <RightSidebar roomId={roomId} ws={ws} />
      </div>

      <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
        <MobileRoomTabs
          roomId={roomId}
          ws={ws}
          onUploadComplete={refreshPlaybackUrl}
          volume={volume}
          setVolume={onSetVolume}
        />
      </div>

      <div className="flex flex-row gap-4 justify-center items-center my-4">
        <span className="ml-4 text-xs text-zinc-400">Global Time: {Math.floor(globalTime)}s</span>
        {syncRef.current && syncRef.current.lastRTT !== undefined && (
          <span className="ml-4 text-xs text-zinc-400">RTT: {syncRef.current.lastRTT?.toFixed(4)}s</span>
        )}
      </div>

      <PlayerControls
        hasTrack={hasTrack}
        trackName={trackName}
        isPlaying={isPlaying}
        volume={volume}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        isShuffle={isShuffle}
        isRepeat={isRepeat}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onSkipBack={onSkipBack}
        onSkipForward={onSkipForward}
        onToggleMute={onToggleMute}
        onSetVolume={onSetVolume}
        onToggleShuffle={onToggleShuffle}
        onToggleRepeat={onToggleRepeat}
      />
    </div>
  );
}
