import { WS_URL } from "./config";
import type { ConnectionStatus } from "./types";

export interface StreamStatusEvent {
  status: ConnectionStatus;
  /** Consecutive failed attempts since the last successful open. */
  attempt: number;
  /** Number of re-connections after the first successful open. Consumers use it to re-sync history. */
  reconnects: number;
}

type Handler = (msg: unknown) => void;

const MAX_BACKOFF_MS = 30_000;
const STALL_MS = 45_000;
const IDLE_CLOSE_MS = 5_000;
const SUBSCRIBE_CHUNK = 100;
const CONNECT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * One shared WebSocket for every subscription in the app.
 *
 * - Streams are reference counted; the socket closes shortly after the last unsubscribe.
 * - Reconnects with exponential backoff and jitter, then re-subscribes everything.
 * - A watchdog replaces connections that stay silent.
 * - Messages are routed by event type + symbol, so a single /ws connection can serve all streams.
 */
export class StreamClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private status: ConnectionStatus = "idle";
  private attempt = 0;
  private opens = 0;
  private lastMessageAt = 0;
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(e: StreamStatusEvent) => void>();
  private browserListenersAttached = false;
  private pendingSub = new Set<string>();
  private pendingUnsub = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCloseCode: number | undefined;
  private lastCloseReason: string | undefined;
  private maxAttemptsReached = false;

  /** Subscribe to a stream such as `btcusdt@kline_1m`. Returns an unsubscribe function. */
  subscribe<T>(stream: string, handler: (msg: T) => void): () => void {
    this.attachBrowserListeners();
    this.clearIdleTimer();

    let set = this.handlers.get(stream);
    const isNew = !set;
    if (!set) {
      set = new Set();
      this.handlers.set(stream, set);
    }
    const h = handler as Handler;
    set.add(h);

    if (isNew) this.queue("SUBSCRIBE", stream);
    if (!this.socket && !this.reconnectTimer && this.status !== "offline") this.connect();

    return () => {
      const current = this.handlers.get(stream);
      if (!current) return;
      current.delete(h);
      if (current.size === 0) {
        this.handlers.delete(stream);
        this.queue("UNSUBSCRIBE", stream);
        if (this.handlers.size === 0) this.scheduleIdleClose();
      }
    };
  }

  onStatus(listener: (e: StreamStatusEvent) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /* ------------------------------ internals ------------------------------ */

  private snapshot(): StreamStatusEvent {
    return { status: this.status, attempt: this.attempt, reconnects: Math.max(0, this.opens - 1) };
  }

  /** Last WebSocket close code (for diagnostics). Undefined while connected or never connected. */
  closeCode(): number | undefined {
    return this.lastCloseCode;
  }

  /** Last WebSocket close reason (for diagnostics). Undefined while connected or never connected. */
  closeReason(): string | undefined {
    return this.lastCloseReason;
  }

  /** True after MAX_RECONNECT_ATTEMPTS consecutive failures; consumers should show a hard error. */
  isMaxAttemptsReached(): boolean {
    return this.maxAttemptsReached;
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    const e = this.snapshot();
    this.listeners.forEach((l) => l(e));
  }

  private connect() {
    if (this.socket || typeof WebSocket === "undefined") return;
    this.setStatus(this.attempt === 0 && this.opens === 0 ? "connecting" : "reconnecting");

    const ws = new WebSocket(WS_URL);
    this.socket = ws;

    // Hard timeout: if the socket does not open within CONNECT_TIMEOUT_MS, abort and retry.
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.socket === ws) {
        this.socket = null;
        try { ws.close(); } catch { /* already closed */ }
        this.scheduleReconnect();
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (this.socket !== ws) return;
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this.attempt = 0;
      this.opens += 1;
      this.lastMessageAt = Date.now();
      this.maxAttemptsReached = false;
      // A fresh socket has no subscriptions: everything currently wanted is sent in one go.
      this.pendingSub.clear();
      this.pendingUnsub.clear();
      this.sendChunked("SUBSCRIBE", [...this.handlers.keys()]);
      this.setStatus("live");
      this.startWatchdog();
    };
    ws.onmessage = (ev) => {
      if (this.socket !== ws || typeof ev.data !== "string") return;
      this.lastMessageAt = Date.now();
      // Data flowing means the connection is healthy: reset the failure counter.
      if (this.attempt > 0) this.attempt = 0;
      this.dispatch(ev.data);
    };
    ws.onerror = () => {
      /* onclose always follows; reconnect is handled there */
    };
    ws.onclose = (ev) => {
      if (this.socket !== ws) return;
      this.socket = null;
      this.stopWatchdog();
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this.lastCloseCode = ev.code === 1005 ? undefined : ev.code;
      this.lastCloseReason = ev.reason || undefined;
      this.scheduleReconnect();
    };
  }

  private dispatch(raw: string) {
    let msg: { e?: string; s?: string; k?: { i: string } };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.e || !msg.s) return; // subscription acks and unknown payloads
    const sym = msg.s.toLowerCase();
    let key: string | undefined;
    switch (msg.e) {
      case "24hrMiniTicker":
        key = `${sym}@miniTicker`;
        break;
      case "kline":
        key = msg.k ? `${sym}@kline_${msg.k.i}` : undefined;
        break;
      case "trade":
        key = `${sym}@trade`;
        break;
    }
    if (!key) return;
    this.handlers.get(key)?.forEach((h) => h(msg));
  }

  private send(method: "SUBSCRIBE" | "UNSUBSCRIBE", params: string[]) {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN || params.length === 0) return;
    ws.send(JSON.stringify({ method, params, id: this.nextId++ }));
  }

  /**
   * Subscription changes are batched: Binance allows only 5 control messages per second per connection,
   * so changing 100 symbols at once must not send 100 messages.
   */
  private queue(method: "SUBSCRIBE" | "UNSUBSCRIBE", stream: string) {
    const [add, opposite] = method === "SUBSCRIBE" ? [this.pendingSub, this.pendingUnsub] : [this.pendingUnsub, this.pendingSub];
    if (!opposite.delete(stream)) add.add(stream); // a queued opposite request cancels out
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const unsubs = [...this.pendingUnsub];
      const subs = [...this.pendingSub];
      this.pendingUnsub.clear();
      this.pendingSub.clear();
      this.sendChunked("UNSUBSCRIBE", unsubs);
      this.sendChunked("SUBSCRIBE", subs);
    }, 50);
  }

  private sendChunked(method: "SUBSCRIBE" | "UNSUBSCRIBE", streams: string[]) {
    for (let i = 0, n = 0; i < streams.length; i += SUBSCRIBE_CHUNK, n++) {
      const chunk = streams.slice(i, i + SUBSCRIBE_CHUNK);
      if (n === 0) this.send(method, chunk);
      else setTimeout(() => this.send(method, chunk), n * 250);
    }
  }

  private scheduleReconnect() {
    if (this.handlers.size === 0) {
      this.setStatus("idle");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return; // the "online" listener resumes
    }
    // Circuit breaker: stop reconnecting after MAX_RECONNECT_ATTEMPTS consecutive failures.
    if (this.attempt >= MAX_RECONNECT_ATTEMPTS) {
      this.maxAttemptsReached = true;
      this.setStatus("offline");
      return;
    }
    this.attempt += 1;
    this.setStatus("reconnecting");
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.attempt - 1));
    const delay = base * (0.75 + Math.random() * 0.5);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      if (this.socket && Date.now() - this.lastMessageAt > STALL_MS) this.dropSocket();
    }, 10_000);
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  /** Abandon the current socket without waiting for a close handshake, then reconnect. */
  private dropSocket() {
    const ws = this.socket;
    this.socket = null;
    this.stopWatchdog();
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
    this.scheduleReconnect();
  }

  private scheduleIdleClose() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.handlers.size > 0) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      const ws = this.socket;
      this.socket = null;
      this.stopWatchdog();
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        ws.close();
      }
      this.attempt = 0;
      this.setStatus("idle");
    }, IDLE_CLOSE_MS);
  }

  private clearIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private attachBrowserListeners() {
    if (this.browserListenersAttached || typeof window === "undefined") return;
    this.browserListenersAttached = true;
    window.addEventListener("online", () => {
      if (this.handlers.size === 0 || this.socket) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.attempt = 0;
      this.connect();
    });
    window.addEventListener("offline", () => {
      if (this.handlers.size > 0) this.setStatus("offline");
    });
  }
}

let client: StreamClient | null = null;

export function getStreamClient(): StreamClient {
  if (!client) client = new StreamClient();
  return client;
}
