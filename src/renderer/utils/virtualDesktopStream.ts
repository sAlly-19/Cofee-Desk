/**
 * Cria uma stream de canvas animada simulando uma área de trabalho virtual com relógio em tempo real.
 * Usado como fallback quando o navegador web bloqueia captura automática de tela sem clique.
 */
export function createVirtualDesktopStream(label: string): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new MediaStream();

  let frame = 0;
  let active = true;

  const render = () => {
    if (!active) return;
    frame++;

    // Fundo degradê café escuro
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1c100a');
    grad.addColorStop(0.5, '#120905');
    grad.addColorStop(1, '#080402');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grade sutil
    ctx.strokeStyle = 'rgba(255, 120, 0, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Janela simulada
    ctx.fillStyle = 'rgba(28, 16, 10, 0.88)';
    ctx.strokeStyle = 'rgba(255, 140, 30, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 100, canvas.width - 280, canvas.height - 200, 16);
    ctx.fill();
    ctx.stroke();

    // Barra da janela simulada
    ctx.fillStyle = 'rgba(255, 140, 30, 0.15)';
    ctx.fillRect(140, 100, canvas.width - 280, 42);

    ctx.fillStyle = '#ff7a00';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☕ Coffee-Desk Remote Stream (Virtual P2P)', canvas.width / 2, 230);

    ctx.fillStyle = 'rgba(255, 230, 215, 0.85)';
    ctx.font = '18px sans-serif';
    ctx.fillText(label, canvas.width / 2, 280);

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, 340);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Transmissão WebRTC em tempo real • 60 FPS', canvas.width / 2, 380);

    // Círculo animado pulsante
    const pulse = Math.sin(frame * 0.08) * 12;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 450, 24 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 120, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  // Renderiza primeiro frame sincronicamente para garantir conteúdo válido
  render();

  try {
    const captureFn = canvas.captureStream || (canvas as any).mozCaptureStream;
    if (!captureFn) {
      console.warn('[WebRTC] captureStream indisponível no navegador');
      return new MediaStream();
    }
    const stream = captureFn.call(canvas, 30);
    stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
      track.addEventListener('ended', () => {
        active = false;
      });
    });

    const loop = () => {
      if (!active) return;
      render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return stream;
  } catch (err) {
    console.warn('[WebRTC] Falha no canvas.captureStream:', err);
    return new MediaStream();
  }
}
