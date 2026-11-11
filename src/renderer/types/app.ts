export type View = 'home' | 'session';
export type SessionRole = 'client' | 'host';
export type Tab = 'clipboard' | 'files';
export type ConnectionStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'error';
export type ServerStatus = 'connecting' | 'connected' | 'disconnected';
export type NavItemKey = 'identity' | 'remote' | 'recent' | 'settings' | 'help';

export interface RecentSession {
  id: string;
  name: string;
  remoteId: string;
  dateStr: string;
}

export interface IncomingCall {
  fromId: string;
  fromName: string;
  password?: string;
  expiresAt: number;
}
