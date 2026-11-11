// Canais de IPC entre processo Main e Renderer
// Mantenha sincronizado com o signaling-server se necessário

export const IPC_CHANNELS = {
  // Janela / App
  APP_READY: 'app:ready',
  APP_QUIT: 'app:quit',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Identidade e sessão
  GET_MY_ID: 'session:getMyId',
  SET_MY_ID: 'session:setMyId',
  GET_SESSION_INFO: 'session:getInfo',

  // Conexão remota
  CONNECT_REQUEST: 'remote:connectRequest',
  CONNECT_ACCEPT: 'remote:connectAccept',
  CONNECT_REJECT: 'remote:connectReject',
  CONNECT_DISCONNECT: 'remote:disconnect',
  CONNECTION_STATE: 'remote:connectionState',

  // Controle remoto (eventos de entrada)
  REMOTE_MOUSE_MOVE: 'remote:mouseMove',
  REMOTE_MOUSE_CLICK: 'remote:mouseClick',
  REMOTE_MOUSE_SCROLL: 'remote:mouseScroll',
  REMOTE_KEY_PRESS: 'remote:keyPress',
  REMOTE_KEY_RELEASE: 'remote:keyRelease',

  // Transferência de arquivos
  FILE_LIST_REQUEST: 'file:listRequest',
  FILE_LIST_RESPONSE: 'file:listResponse',
  FILE_TRANSFER_REQUEST: 'file:transferRequest',
  FILE_TRANSFER_ACCEPT: 'file:transferAccept',
  FILE_TRANSFER_DATA: 'file:transferData',
  FILE_TRANSFER_PROGRESS: 'file:transferProgress',
  FILE_TRANSFER_COMPLETE: 'file:transferComplete',

  // Clipboard compartilhado
  CLIPBOARD_SET: 'clipboard:set',
  CLIPBOARD_GET: 'clipboard:get',
  CLIPBOARD_CHANGED: 'clipboard:changed',

  // Captura de tela
  DESKTOP_SOURCES: 'screen:getSources',
  DESKTOP_STREAM_START: 'screen:streamStart',
  DESKTOP_STREAM_STOP: 'screen:streamStop',

  // Erros
  ERROR_OCCURRED: 'error:occurred',

  // WebRTC (sinalização peer-to-peer)
  WEBRTC_CREATE_OFFER: 'webrtc:createOffer',
  WEBRTC_SET_REMOTE_DESCRIPTION: 'webrtc:setRemoteDescription',
  WEBRTC_ADD_ICE_CANDIDATE: 'webrtc:addIceCandidate',

  // Controle remoto de input (mouse/teclado via data channel)
  REMOTE_INPUT_MOUSE: 'remote:input:mouse',
  REMOTE_INPUT_KEYBOARD: 'remote:input:keyboard',
  REMOTE_CONTROL_TOGGLE: 'remote:control:toggle',
  REMOTE_CONTROL_STATUS: 'remote:control:status',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
