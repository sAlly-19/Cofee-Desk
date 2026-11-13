import { videoPoint } from "../../shared/geometry";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MouseEvent,
  type WheelEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

interface UseRemoteInputCaptureProps {
  role: "host" | "client";
  allowed: boolean;
  pointerChannelRef?: RefObject<RTCDataChannel | null>;
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
  pointerChannelRef,
  containerRef,
}: UseRemoteInputCaptureProps) {
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [hostControlEnabled, setHostControlEnabled] = useState(true);
  const pointerSequence = useRef(0);
  const frame = useRef(0),
    pendingMove = useRef<ReturnType<typeof videoPoint>>(null),
    allowedNow = useRef(allowed);
  allowedNow.current = allowed;
  const release = useCallback(() => {
    const dc = dataChannelRef.current;
    if (dc?.readyState === "open")
      dc.send(JSON.stringify({ type: "release-input" }));
  }, [dataChannelRef]);
  useEffect(() => {
    const blur = () => {
      pendingMove.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      release();
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur);
      blur();
    };
  }, [release]);
  useEffect(() => {
    if (!allowed) {
      pendingMove.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      release();
    }
  }, [allowed, release]);
  const getNormalizedCoords = (e: MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    return videoPoint(
      video.getBoundingClientRect(),
      video.videoWidth,
      video.videoHeight,
      e.clientX,
      e.clientY,
    );
  };

  // Coalesce events per animation frame, retaining the final pointer position.
  const handleMouseMove = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const coords = getNormalizedCoords(e);
    if (!coords) return;
    pendingMove.current = coords;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const point = pendingMove.current;
      pendingMove.current = null;
      if (!allowedNow.current || !point) return;
      const dc =
        pointerChannelRef?.current?.readyState === "open"
          ? pointerChannelRef.current
          : dataChannelRef.current;
      if (dc?.readyState === "open")
        dc.send(
          JSON.stringify({
            type: "mouse",
            seq: ++pointerSequence.current,
            data: {
              type: "move",
              x: point.pixelX,
              y: point.pixelY,
              normX: point.normX,
              normY: point.normY,
            },
          }),
        );
    });
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
