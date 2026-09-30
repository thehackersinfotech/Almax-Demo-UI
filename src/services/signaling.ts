import { ACCESS_TOKEN_KEY } from "@/store/auth";

export type SignalHandler = (type: string, payload: any, senderId: string) => void;

export class CallSignalingClient {
  private socket: WebSocket | null = null;
  private callId: string;
  private onSignalCallback: SignalHandler | null = null;

  constructor(callId: string) {
    this.callId = callId;
  }

  public connect(onSignal: SignalHandler): Promise<void> {
    this.onSignalCallback = onSignal;
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const prefix = window.location.pathname.startsWith("/bms") ? "bms" : "pmt";
      const tenantSlug = localStorage.getItem("bms_tenant_slug") || "hit";
      const wsUrl = `${protocol}//${host}/${prefix}/ws/calls/${this.callId}/?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantSlug)}`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        resolve();
      };

      this.socket.onerror = (err) => {
        reject(err);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onSignalCallback) {
            let sigType = data.type;
            let sigPayload = data.payload;
            if (data.signal) {
              if (typeof data.signal === "object" && data.signal !== null) {
                sigType = data.signal.type || sigType;
                sigPayload = data.signal.payload !== undefined ? data.signal.payload : data.signal;
              } else if (typeof data.signal === "string") {
                sigType = data.signal;
              }
            }
            if (sigType) {
              this.onSignalCallback(sigType, sigPayload, data.sender_id);
            }
          }
        } catch (e) {
          console.error("Signaling message parse error:", e);
        }
      };

      this.socket.onclose = (event) => {
        console.log("Call signaling closed:", event.code, event.reason);
      };
    });
  }

  public send(type: string, payload: any = {}) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload, call_id: this.callId }));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
