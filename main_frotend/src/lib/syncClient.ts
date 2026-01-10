export class SyncClient {
  constructor(getTime: () => number) {
    this.getTime= getTime;
    this.offset = 0;
    this.frequencyRatio = 1;
    this.running = false;
  }

  start(sendFunction: (pingId: number, clientPingTime: number) => void, receiveFunction: (callback: Function) => void, onStatus?: (status: any) => void) {
    this.running = true;
    let pingId = 0;
    const syncLoop = () => {
      if (!this.running) return;
      const clientPingTime = this.getTime();
      sendFunction(pingId, clientPingTime);
      pingId++;
      setTimeout(syncLoop, 1000);
    };
    receiveFunction((pingId: number, clientPingTime: number, serverPingTime: number, serverPongTime: number) => {
      const now = this.getTime();
      const offset = ((serverPingTime - clientPingTime) + (serverPongTime - now)) / 2;
      this.offset = offset;
      if (onStatus) onStatus({ offset });
    });
    syncLoop();
  }

  stop() { this.running = false; }

  getSyncTime() { return this.getTime() + this.offset; }
}
