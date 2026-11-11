import Store from 'electron-store';
import { CoffeeDeskId } from '../shared/types';

interface StoreSchema {
  coffeeDeskId: CoffeeDeskId;
  session: {
    remoteId: string | null;
    autoAccept: boolean;
  };
  settings: {
    quality: 'low' | 'medium' | 'high';
    frameRate: number;
    enableClipboardSync: boolean;
    enableFileTransfer: boolean;
  };
}

export const store = new Store<StoreSchema>({
  name: 'coffee-desk-config',
  defaults: {
    coffeeDeskId: {
      id: '',
      createdAt: '',
    },
    session: {
      remoteId: null,
      autoAccept: false,
    },
    settings: {
      quality: 'medium',
      frameRate: 30,
      enableClipboardSync: true,
      enableFileTransfer: true,
    },
  },
});

/**
 * Gera ou recupera o Coffee-Desk ID único da instância.
 */
export function getOrCreateCoffeeDeskId(): CoffeeDeskId {
  const existing = store.get('coffeeDeskId');
  if (existing.id && existing.createdAt) {
    return existing;
  }

  const newId: CoffeeDeskId = {
    id: generateDeskId(),
    createdAt: new Date().toISOString(),
  };

  store.set('coffeeDeskId', newId);
  return newId;
}

/**
 * Gera um ID de 9 dígitos no formato XXX-XXX-XXX (padrão AnyDesk/Coffee-Desk)
 */
function generateDeskId(): string {
  const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
  return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
}
