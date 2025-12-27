import { useEffect, useRef, useState } from "react";
import { SyncClient } from "@ircam/sync";

export default function AudioSync() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [globalTime, setGlobalTime] = useState<number>(0);

  useEffect(() => {
  // use the current host so the client will connect to the backend on the same machine
  // this allows other devices to connect via http://<your-lan-ip>:3000 and the WS will use that host
  const host = window.location.hostname || "localhost";
  const socket = new WebSocket(`wss://ginny-uncontradicted-sonorously.ngrok-free.dev`);
    socketRef.current = socket;

    // sync client
    const getTime = () => performance.now() / 1000;
    const sync = new SyncClient(getTime);
    syncRef.current = sync;

    // when socket opens
    socket.addEventListener("open", () => {
      const sendFunction = (pingId, clientPingTime) => {
        socket.send(JSON.stringify([0, pingId, clientPingTime]));
      };

      const receiveFunction = (callback) => {
        socket.addEventListener("message", (e) => {
          const msg = JSON.parse(e.data);
          if (msg[0] === 1) {
            callback(msg[1], msg[2], msg[3], msg[4]);
          }
        });
      };

      sync.start(sendFunction, receiveFunction, (status: any) => {
        console.log("sync status:", status);
        // if server suggests a frequencyRatio, apply it to the audio playbackRate
        try {
          const audioEl = audioRef.current;
          if (audioEl && typeof status?.frequencyRatio === "number") {
            audioEl.playbackRate = status.frequencyRatio;
          }
        } catch (e) {
          // ignore
        }
      });
    });

    // receive play/pause commands
    socket.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      const sync = syncRef.current;
      const audio = audioRef.current;

      if (data.type === "play") {
        if (!audio || !sync?.getSyncTime) return;
        
        const now = sync.getSyncTime();
        const delay = Math.max(0, (data.executeAt - now) * 1000);
        
        console.log(`[PLAY RECEIVED] now=${now.toFixed(3)}, executeAt=${data.executeAt.toFixed(3)}, delay=${delay.toFixed(0)}ms, currentTime=${data.currentTime}`);
        
        // Seek to the position immediately
        if (typeof data.currentTime === "number") {
          audio.currentTime = data.currentTime;
          console.log(`Seeked to ${data.currentTime.toFixed(3)}`);
        }
        
        // Schedule play at the exact 2-second mark
        setTimeout(() => {
          const actualNow = sync.getSyncTime();
          const diff = (actualNow - data.executeAt) * 1000;
          console.log(`[PLAY EXECUTING] syncTime=${actualNow.toFixed(3)}, target=${data.executeAt.toFixed(3)}, diff=${diff.toFixed(2)}ms`);
          audio.play().catch((err) => console.warn("play() failed:", err));
        }, delay);
      }

      if (data.type === "pause") {
        if (!audio || !sync?.getSyncTime) return;
        
        const now = sync.getSyncTime();
        const delay = Math.max(0, (data.executeAt - now) * 1000);
        
        console.log(`[PAUSE RECEIVED] now=${now.toFixed(3)}, executeAt=${data.executeAt.toFixed(3)}, delay=${delay.toFixed(0)}ms`);
        
        // Schedule pause at the exact 2-second mark
        setTimeout(() => {
          const actualNow = sync.getSyncTime();
          const diff = (actualNow - data.executeAt) * 1000;
          console.log(`[PAUSE EXECUTING] syncTime=${actualNow.toFixed(3)}, target=${data.executeAt.toFixed(3)}, diff=${diff.toFixed(2)}ms`);
          
          // Seek to exact position when pausing
          if (typeof data.currentTime === "number") {
            audio.currentTime = data.currentTime;
          }
          audio.pause();
        }, delay);
      }
    });
  }, []);

  // update visible global time (from sync) continuously
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sync = syncRef.current;
      if (sync && typeof sync.getSyncTime === "function") {
        setGlobalTime(sync.getSyncTime());
      } else {
        setGlobalTime(performance.now() / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // user clicks - send a desired executeAt based on the synced timeline
  const play = () => {
    const socket = socketRef.current;
    const sync = syncRef.current;
    const audio = audioRef.current as HTMLAudioElement | null;
    if (!socket || !sync || !audio) return;

    const now = sync.getSyncTime();
    
    // Round up to the next whole 2-second mark
    // If now is 139.6, nextMark will be 142
    const nextMark = Math.ceil(now / 2) * 2;
    const executeAt = nextMark;
    
    // Current audio position
    const currentTime = audio.currentTime || 0;

    console.log(`[PLAY REQUEST] now=${now.toFixed(3)}, executeAt=${executeAt.toFixed(3)}, delay=${(executeAt - now).toFixed(3)}s, currentTime=${currentTime.toFixed(3)}`);

    // send request to server with the desired execute time and current audio position
    socket.send(JSON.stringify({ type: "play-request", executeAt, currentTime }));
  };

  const pause = () => {
    const socket = socketRef.current;
    const sync = syncRef.current;
    const audio = audioRef.current as HTMLAudioElement | null;
    if (!socket || !sync || !audio) return;

    const now = sync.getSyncTime();
    
    // Round up to the next whole 2-second mark for pause as well
    const nextMark = Math.ceil(now / 2) * 2;
    const executeAt = nextMark;
    
    const currentTime = audio.currentTime || 0;

    console.log(`[PAUSE REQUEST] now=${now.toFixed(3)}, executeAt=${executeAt.toFixed(3)}, delay=${(executeAt - now).toFixed(3)}s, currentTime=${currentTime.toFixed(3)}`);

    socket.send(JSON.stringify({ type: "pause-request", executeAt, currentTime }));
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>Global time: {globalTime.toFixed(3)} s</div>
      <audio ref={audioRef} src="https://objectstorage.ap-mumbai-1.oraclecloud.com/n/bmrt4dqkkyyu/b/your-music-bucket/o/Paresh%20Pahuja%20-%20Dooron%20Dooron%20(Live%20from%20The%20Voice%20Notes%20Concert)%20-%20Paresh%20Pahuja.mp3" preload="auto" playsInline crossOrigin="anonymous" />
      <button onClick={play}>Play (Sync)</button>
      <button onClick={pause}>Pause (Sync)</button>
    </div>
  );
}
