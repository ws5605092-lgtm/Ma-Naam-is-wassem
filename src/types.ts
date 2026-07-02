export interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer; // Encrypted file data
  iv: string; // Hex string of the AES-GCM IV
  addedAt: number;
  folderId: string; // 'root' or specific folder ID
}

export interface VaultFileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  addedAt: number;
  folderId: string;
}

export interface VaultFolder {
  id: string;
  name: string;
  addedAt: number;
}

export interface VaultSettings {
  hasSetup: boolean;
  masterPinHash: string;
  decoyPinHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
}

export interface SecurityLog {
  id: string;
  timestamp: number;
  event: 'unlock_success' | 'unlock_failed' | 'decoy_unlock' | 'pin_changed' | 'security_setup' | 'failed_attempt' | 'files_deleted';
  details: string;
}
