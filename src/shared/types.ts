export interface AccountSummary {
  id: string;
  website: string;
  label: string;
  createdAt: string;
  total: number;
  remaining: number;
  used: number;
}

export interface ParsedCode {
  value: string;
  used: boolean;
}
export interface ParseResult {
  format: string;
  codes: ParsedCode[];
  warnings: string[];
}
export interface ImportInput {
  website: string;
  label: string;
  codes: ParsedCode[];
}
export interface RevealResult {
  token: string;
  code: string;
  accountId: string;
}
export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export interface DeviceAuthStatus {
  supported: boolean;
  enabled: boolean;
  label: string;
  reason?: string;
}

export interface VaultAPI {
  status(): Promise<VaultStatus>;
  create(password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): Promise<void>;
  list(): Promise<AccountSummary[]>;
  parse(text: string, website: string): Promise<ParseResult>;
  chooseFile?(
    website: string,
  ): Promise<{ name: string; result: ParseResult } | null>;
  importCodes(input: ImportInput): Promise<void>;
  reveal(accountId: string, password: string): Promise<RevealResult>;
  finishReveal(token: string, used: boolean): Promise<void>;
  copy(token: string): Promise<void>;
  exportVault(): Promise<boolean>;
  deviceAuthStatus?(): Promise<DeviceAuthStatus>;
  enableDeviceAuth?(password: string): Promise<void>;
  disableDeviceAuth?(password: string): Promise<void>;
  unlockWithDevice?(): Promise<void>;
  onLocked?(callback: () => void): () => void;
}

declare global {
  interface Window {
    bacom?: VaultAPI;
  }
}
