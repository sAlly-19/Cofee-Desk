import { videoPoint } from "../../shared/geometry";
import {
  useState,
  useRef,
  type MouseEvent,
  type WheelEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

interface UseRemoteInputCaptureProps {
  role: "host" | "client";
  allowed: boolean;
  dataChannelRef: RefObject<RTCDataChannel | null>;
  containerRef: RefObject<HTMLDivElement | null>;
}

const buttonMap: Record<number, "left" | "right" | "middle"> = {
  0: "left",
  1: "middle",
  2: "right",
};

const SYSTEM_KEYS = [
  "Tab",
  "Backspace",
  "Enter",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "F5",
];

export function useRemoteInputCapture({
  role,
  allowed,
  dataChannelRef,
  containerRef,
}: UseRemoteInputCaptureProps) {
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [hostControlEnabled, setHostControlEnabled] = useState(true);
  const lastMoveSentRef = useRef<number>(0);

  // Mapeamento preciso de coordenadas compensando letterbox / pillarbox (object-fit: contain)
  const getNormalizedCoords = (e: MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();

    return videoPoint(
      rect,
      video.videoWidth,
      video.videoHeight,
      e.clientX,
      e.clientY,
    );
  };

  // Movimento suave com throttling a ~60fps
  const handleMouseMove = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    const now = performance.now();
    if (now - lastMoveSentRef.current < 16) return;
    lastMoveSentRef.current = now;

    const coords = getNormalizedCoords(e);
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "move",
          x: pixelX,
          y: pixelY,
          normX,
          normY,
        },
      }),
    );
  };

  const handleMouseDown = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    containerRef.current?.focus();
    const coords = getNormalizedCoords(e);
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;
    const button = buttonMap[e.button] || "left";

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "down",
          button,
          x: pixelX,
          y: pixelY,
          normX,
          normY,
        },
      }),
    );
  };

  const handleMouseUp = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;
    const button = buttonMap[e.button] || "left";

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "up",
          button,
          x: pixelX,
          y: pixelY,
          normX,
          normY,
        },
      }),
    );
  };

  const handleDoubleClick = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "double",
          button: "left",
          x: pixelX,
          y: pixelY,
          normX,
          normY,
        },
      }),
    );
  };

  const handleContextMenu = (e: MouseEvent<HTMLVideoElement>) => {
    e.preventDefault();
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "click",
          button: "right",
          x: pixelX,
          y: pixelY,
          normX,
          normY,
        },
      }),
    );
  };

  const handleWheel = (e: WheelEvent<HTMLVideoElement>) => {
    e.preventDefault();
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    const coords = getNormalizedCoords(
      e as unknown as MouseEvent<HTMLVideoElement>,
    );
    if (!coords) return;
    const { normX, normY, pixelX, pixelY } = coords;

    dc.send(
      JSON.stringify({
        type: "mouse",
        data: {
          type: "scroll",
          x: pixelX,
          y: pixelY,
          normX,
          normY,
          scrollDelta: { x: e.deltaX, y: e.deltaY },
        },
      }),
    );
  };

  // Captura de teclado com foco
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    if (SYSTEM_KEYS.includes(e.key) || e.ctrlKey || e.altKey) {
      e.preventDefault();
    }

    dc.send(
      JSON.stringify({
        type: "keyboard",
        data: {
          type: "down",
          key: e.key,
          code: e.code,
          modifiers: {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            meta: e.metaKey,
          },
        },
      }),
    );
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role === "host" || !allowed) return;
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    if (SYSTEM_KEYS.includes(e.key) || e.ctrlKey || e.altKey) {
      e.preventDefault();
    }

    dc.send(
      JSON.stringify({
        type: "keyboard",
        data: {
          type: "up",
          key: e.key,
          code: e.code,
          modifiers: {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            meta: e.metaKey,
          },
        },
      }),
    );
  };

  const toggleHostControl = async () => {
    if (window.electronAPI?.toggleInputControl) {
      const newState = await window.electronAPI.toggleInputControl();
      setHostControlEnabled(newState);
    } else {
      setHostControlEnabled((prev) => !prev);
    }
  };

  return {
    isKeyboardFocused,
    setIsKeyboardFocused,
    hostControlEnabled,
    toggleHostControl,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleDoubleClick,
    handleContextMenu,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
  };
}
