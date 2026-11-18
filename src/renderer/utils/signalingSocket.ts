/** Narrow socket facade: the authenticated connection and authority live in main. */
export class SignalingSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  private token = crypto.randomUUID();
  private unsubscribe: () => void;
  constructor() {
    this.unsubscribe = window.electronAPI.signaling.onEvent((event) => {
      if (event.connection !== this.token) return;
      if (event.kind === "open") {
        this.readyState = 1;
        this.onopen?.();
      }
      if (event.kind === "message")
        this.onmessage?.({ data: JSON.stringify(event.message) });
      if (event.kind === "error") this.onerror?.();
      if (event.kind === "close") {
        this.readyState = 3;
        this.unsubscribe();
        this.onclose?.({ code: event.code ?? 1006 });
      }
    });
    void window.electronAPI.signaling.open(this.token).catch(() => {
      this.onerror?.();
      this.readyState = 3;
      this.unsubscribe();
      this.onclose?.({ code: 1006 });
    });
  }
  send(data: string) {
    if (this.readyState !== 1) return;
    void window.electronAPI.signaling
      .send(this.token, JSON.parse(data))
      .catch(() => this.onmessage?.({data:JSON.stringify({type:"error",code:"LOCAL_SIGNALING_STATE",message:"A solicitação não pôde ser aplicada. Reconecte ao serviço e tente novamente."})}));
  }
  close(_code?: number, _reason?: string) {
    this.readyState = 3;
    void window.electronAPI.signaling
      .close(this.token)
      .finally(() => this.unsubscribe());
  }
}
