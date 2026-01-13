// Complete Buffer polyfill for browser environments
// Provides minimal API surface needed for cryptographic operations

class BrowserBuffer extends Uint8Array {
  constructor(input) {
    if (typeof input === 'number') {
      super(input);
    } else if (input instanceof ArrayBuffer) {
      super(input);
    } else if (input instanceof Uint8Array) {
      super(input);
    } else if (Array.isArray(input)) {
      super(input);
    } else {
      super(0);
    }
  }

  static from(data, encoding) {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        return BrowserBuffer.fromHex(data);
      } else if (encoding === 'base64') {
        return BrowserBuffer.fromBase64(data);
      } else {
        const bytes = new TextEncoder().encode(data);
        return new BrowserBuffer(bytes);
      }
    } else if (data instanceof ArrayBuffer) {
      return new BrowserBuffer(new Uint8Array(data));
    } else if (data instanceof Uint8Array) {
      return new BrowserBuffer(data);
    } else if (Array.isArray(data)) {
      return new BrowserBuffer(data);
    }
    throw new Error('Unsupported data type for Buffer.from');
  }

  static fromHex(hex) {
    const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) {
      throw new Error('Invalid hex string');
    }
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16);
    }
    return new BrowserBuffer(bytes);
  }

  static fromBase64(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new BrowserBuffer(bytes);
  }

  toString(encoding) {
    if (encoding === 'hex') {
      return Array.from(this)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else if (encoding === 'base64') {
      const binaryString = String.fromCharCode(...Array.from(this));
      return btoa(binaryString);
    } else {
      return new TextDecoder().decode(this);
    }
  }

  slice(start, end) {
    const sliced = super.slice(start, end);
    return new BrowserBuffer(sliced);
  }
}

// Install Buffer polyfill
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = BrowserBuffer;
}

// Install process polyfill
if (typeof globalThis.process === 'undefined') {
  globalThis.process = { 
    env: {},
    version: 'browser',
    platform: 'browser'
  };
}

// Install crypto polyfill if needed
if (typeof globalThis.crypto === 'undefined' && typeof window !== 'undefined' && window.crypto) {
  globalThis.crypto = window.crypto;
}

export { BrowserBuffer as Buffer };
