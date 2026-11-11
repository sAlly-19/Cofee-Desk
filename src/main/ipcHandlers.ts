import { ipcMain, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import { store } from './store';

function getUniqueFilePath(dir: string, fileName: string): string {
  let targetPath = path.join(dir, fileName);
  if (!fs.existsSync(targetPath)) return targetPath;

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let counter = 1;
  while (fs.existsSync(targetPath)) {
    targetPath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return targetPath;
}

/**
 * Registra todos os handlers de IPC gerais do processo Main.
 * Chamado após a inicialização do app.
 */
export function registerIpcHandlers(): void {
  // Persistência de configurações
  ipcMain.on(IPC_CHANNELS.SET_MY_ID, (_event, id: string) => {
    store.set('coffeeDeskId.id', id);
  });

  ipcMain.on('session:setRemoteId', (_event, remoteId: string | null) => {
    store.set('session.remoteId', remoteId);
  });

  ipcMain.on('settings:set', (_event, key: string, value: unknown) => {
    store.set(`settings.${key}`, value);
  });

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return store.get(`settings.${key}`);
  });

  // Salvar arquivo recebido na pasta Downloads nativa
  ipcMain.handle(
    'file:saveToDownloads',
    async (_event, { fileName, base64Data }: { fileName: string; base64Data: string }) => {
      try {
        const downloadsDir = app.getPath('downloads');
        const targetPath = getUniqueFilePath(downloadsDir, fileName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetPath, buffer);
        console.log(`[FileTransfer] Arquivo salvo em: ${targetPath}`);
        return { success: true, filePath: targetPath };
      } catch (err: any) {
        console.error('[FileTransfer] Erro ao salvar arquivo:', err);
        return { success: false, error: err?.message || 'Falha ao salvar arquivo' };
      }
    }
  );

  // Revelar arquivo salvo no Windows Explorer
  ipcMain.handle('file:showInFolder', async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'Arquivo não encontrado' };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  // Abrir arquivo com o aplicativo padrão
  ipcMain.handle('file:openFile', async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
      }
      return { success: false, error: 'Arquivo não encontrado' };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });
}
