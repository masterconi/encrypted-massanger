/**
 * Cryptographic types and interfaces
 * 
 * All cryptographic operations use constant-time implementations where possible.
 * Keys are stored in secure memory and zeroed when no longer needed.
 */

export type PublicKey = Uint8Array;
export type PrivateKey = Uint8Array;
export type SharedSecret = Uint8Array;
export type Nonce = Uint8Array;
export type MAC = Uint8Array;
export type Ciphertext = Uint8Array;

export interface IdentityKeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

export interface EphemeralKeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

export interface ChainKey {
  key: Uint8Array;
  index: number;
}

export interface MessageKey {
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
  iv?: Uint8Array;
  index: number;
}

export interface RootKey {
  key: Uint8Array;
}

export interface RatchetState {
  rootKey: RootKey;
  sendingChainKey?: ChainKey;
  receivingChainKey?: ChainKey;
  sendingEphemeralKey?: EphemeralKeyPair;
  receivingEphemeralPublicKey?: PublicKey;
  sendCounter: number;
  receiveCounter: number;
  skippedMessageKeys: Map<number, MessageKey>;
  previousChainLength: number;
}
