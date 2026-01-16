/**
 * Browser WebSocket adapter
 * Adapts the native WebSocket API to work with our client
 */

export class BrowserWebSocket extends EventTarget {
  private ws: WebSocket;
  private listeners: Map<Function, EventListener> = new Map();

  constructor(url: string) {
    super();
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.dispatchEvent(new Event('open'));
    };

    this.ws.onclose = (event) => {
      const closeEvent = new CustomEvent('close', {
        detail: {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        }
      });
      this.dispatchEvent(closeEvent);
    };

    this.ws.onerror = () => {
      this.dispatchEvent(new Event('error'));
    };

    this.ws.onmessage = async (event) => {
      let data: ArrayBuffer;

      if (event.data instanceof Blob) {
        data = await event.data.arrayBuffer();
      } else if (event.data instanceof ArrayBuffer) {
        data = event.data;
      } else {
        console.error('Unexpected message type:', typeof event.data);
        return;
      }

      const messageEvent = new MessageEvent('message', {
        data: Buffer.from(data),
      });
      this.dispatchEvent(messageEvent);
    };
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  get OPEN(): number {
    return WebSocket.OPEN;
  }

  send(data: Uint8Array | ArrayBuffer): void {
    this.ws.send(data);
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    const wrapper = (e: Event) => {
      if (event === 'message' && e instanceof MessageEvent) {
        handler(e.data);
      } else if (event === 'close' && e instanceof CustomEvent) {
        handler(e.detail.code, e.detail.reason);
      } else {
        handler();
      }
    };

    // Store wrapper for removal
    this.listeners.set(handler, wrapper as EventListener);
    this.addEventListener(event, wrapper as EventListener);
  }

  removeListener(event: string, handler: (...args: any[]) => void): void {
    const wrapper = this.listeners.get(handler);
    if (wrapper) {
      this.removeEventListener(event, wrapper);
      this.listeners.delete(handler);
    }
  }
}

// Polyfill Buffer for browser if needed
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    from(data: ArrayBuffer | Uint8Array | number[]): Uint8Array {
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      if (data instanceof Uint8Array) {
        return data;
      }
      return new Uint8Array(data);
    },
  };
}
