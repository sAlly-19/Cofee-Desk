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
  const [mouseCaptured, setMouseCaptured] = useState(false),
    [captureError, setCaptureError] = useState("");
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);
  const [localCursor, setLocalCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const virtualPoint = useRef({ normX: 0.5, normY: 0.5 }),
    frame = useRef(0),
    pendingMove = useRef<ReturnType<typeof videoPoint>>(null),
    allowedNow = useRef(allowed);
  allowedNow.current = allowed;
  const release = useCallback(() => {
    const dc = dataChannelRef.current;
    if (dc?.readyState === "open")
      dc.send(JSON.stringify({ type: "release-input" }));
  }, [dataChannelRef]);
  useEffect(() => {
    const changed = () => {
      const captured =
        !!document.pointerLockElement &&
        containerRef.current?.contains(document.pointerLockElement) === true;
      setMouseCaptured(captured);
      if (!captured) {
        setLocalCursor(null);
        release();
      }
    };
    const blur = () => {
      pendingMove.current = null;
      pendingCursor.current = null;
      setLocalCursor(null);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      if (document.pointerLockElement) document.exitPointerLock();
      release();
    };
    document.addEventListener("pointerlockchange", changed);
    window.addEventListener("blur", blur);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (
        document.pointerLockElement &&
        containerRef.current?.contains(document.pointerLockElement)
      )
        document.exitPointerLock();
      document.removeEventListener("pointerlockchange", changed);
      window.removeEventListener("blur", blur);
      release();
    };
  }, [containerRef, release]);
  useEffect(() => {
    if (!allowed) {
      pendingMove.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [allowed]);
  const toggleMouseCapture = async () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
      return;
    }
    if (role !== "client" || !allowed) return;
    const video = containerRef.current?.querySelector("video");
    if (!video || !video.videoWidth) return;
    try {
      setCaptureError("");
      await video.requestPointerLock();
      containerRef.current?.focus();
    } catch {
      setCaptureError(
        "O sistema não permitiu capturar o mouse. Clique no vídeo e tente novamente.",
      );
    }
  };

  // Mapeamento preciso de coordenadas compensando letterbox / pillarbox (object-fit: contain)
  const getNormalizedCoords = (
    e: MouseEvent<HTMLVideoElement>,
    moving = false,
  ) => {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();

    if (document.pointerLockElement === video) {
      if (!video.videoWidth || !video.videoHeight) return null;
      const scale = Math.min(
          rect.width / video.videoWidth,
          rect.height / video.videoHeight,
        ),
        width = video.videoWidth * scale,
        height = video.videoHeight * scale;
      if (!width || !height) return null;
      if (moving) {
        virtualPoint.current = {
          normX: Math.max(
            0,
            Math.min(1, virtualPoint.current.normX + e.movementX / width),
          ),
          normY: Math.max(
            0,
            Math.min(1, virtualPoint.current.normY + e.movementY / height),
          ),
        };
      }
      const { normX, normY } = virtualPoint.current;
      pendingCursor.current = {
        x: rect.left + (rect.width - width) / 2 + normX * width,
        y: rect.top + (rect.height - height) / 2 + normY * height,
      };
      return {
        normX,
        normY,
        pixelX: Math.round(normX * (video.videoWidth - 1)),
        pixelY: Math.round(normY * (video.videoHeight - 1)),
      };
    }
    const result = videoPoint(
      rect,
      video.videoWidth,
      video.videoHeight,
      e.clientX,
      e.clientY,
    );
    if (result)
      virtualPoint.current = { normX: result.normX, normY: result.normY };
    return result;
  };

  // Coalesce events per animation frame, retaining the final pointer position.
  const handleMouseMove = (e: MouseEvent<HTMLVideoElement>) => {
    if (role === "host" || !allowed) return;
    const coords = getNormalizedCoords(e, true);
    if (!coords) return;
    pendingMove.current = coords;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (document.pointerLockElement && pendingCursor.current)
        setLocalCursor(pendingCursor.current);
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
    if (e.key === "Escape" && document.pointerLockElement) {
      e.preventDefault();
      document.exitPointerLock();
      return;
    }
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
    mouseCaptured,
    localCursor,
    captureError,
    toggleMouseCapture,
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
