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

  const hasTrack = Boolean(audioUrl);

  const onTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
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
      <TopBar roomId={roomId} />

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
