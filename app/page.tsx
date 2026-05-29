"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Camera,
  ImagePlus,
  Layers2,
  RefreshCcw,
  Save,
  Shirt,
  Snowflake
} from "lucide-react";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type SavedLook = {
  id: string;
  image: string;
  createdAt: number;
};

type OverlayTransform = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};

const defaultTransform: OverlayTransform = {
  x: 50,
  y: 45,
  scale: 1,
  rotate: 0,
  opacity: 0.72
};

const savedKey = "daebogi.savedLooks";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number
) {
  const sourceWidth = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
  const sourceHeight = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function ControlButton({
  active,
  children,
  label,
  onClick
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "toolButton active" : "toolButton"} type="button" onClick={onClick}>
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const handleDragRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const [photo, setPhoto] = useState<string>("");
  const [frozenFrame, setFrozenFrame] = useState<string>("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [transform, setTransform] = useState<OverlayTransform>(defaultTransform);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [selectedLookId, setSelectedLookId] = useState<string>("");
  const [compareLookId, setCompareLookId] = useState<string>("");

  const activeOverlay = frozenFrame;
  const selectedLook = useMemo(
    () => savedLooks.find((look) => look.id === selectedLookId),
    [savedLooks, selectedLookId]
  );
  const compareLook = useMemo(
    () => savedLooks.find((look) => look.id === compareLookId),
    [savedLooks, compareLookId]
  );

  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem(savedKey);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored) as SavedLook[];
        setSavedLooks(parsed);
        setSelectedLookId(parsed[0]?.id ?? "");
      } catch {
        window.localStorage.removeItem(savedKey);
      }
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(savedKey, JSON.stringify(savedLooks.slice(0, 8)));
    } catch {
      // storage quota exceeded; data stays in memory for this session
    }
  }, [savedLooks]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    setFrozenFrame("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 1920 }
        },
        audio: false
      });

      if (!videoRef.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);
    } catch {
      setCameraReady(false);
      setCameraError("카메라 권한이 필요합니다.");
    }
  }

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhoto(await readFile(file));
    setSelectedLookId("");
    setCompareLookId("");
  }

  function freezeFrame() {
    const video = videoRef.current;
    if (!video || !cameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError("카메라를 먼저 켜주세요.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFrozenFrame(canvas.toDataURL("image/jpeg", 0.92));
    setCameraError("");
  }

  async function saveLook() {
    if (!photo) {
      photoInputRef.current?.click();
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      ctx.fillStyle = "#f7f7f3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const photoImage = await loadImage(photo);
      drawImageCover(ctx, photoImage, canvas.width, canvas.height);

      const overlaySource = activeOverlay ? await loadImage(activeOverlay) : videoRef.current;
      if (overlaySource) {
        const overlayWidth = canvas.width * 0.48 * transform.scale;
        const overlayHeight = canvas.height * 0.48 * transform.scale;
        const x = (transform.x / 100) * canvas.width;
        const y = (transform.y / 100) * canvas.height;

        ctx.save();
        ctx.globalAlpha = transform.opacity;
        ctx.translate(x, y);
        ctx.rotate((transform.rotate * Math.PI) / 180);
        drawImageCover(ctx, overlaySource, overlayWidth, overlayHeight);
        ctx.restore();
      }

      const image = canvas.toDataURL("image/jpeg", 0.9);
      const look = { id: crypto.randomUUID(), image, createdAt: Date.now() };
      setSavedLooks((current) => [look, ...current].slice(0, 8));
      setSelectedLookId(look.id);
      setCompareLookId("");
    } catch {
      // image load failed; user can retry
    }
  }

  function resetOverlay() {
    setTransform(defaultTransform);
    setFrozenFrame("");
    setSelectedLookId("");
    setCompareLookId("");
    setCameraError("");
  }

  function updateTransform(key: keyof OverlayTransform, value: number) {
    setTransform((current) => ({ ...current, [key]: value }));
    setSelectedLookId("");
    setCompareLookId("");
  }

  // Overlay drag
  function onOverlayPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y
    };
  }

  function onOverlayPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((event.clientY - dragRef.current.startY) / rect.height) * 100;
    setTransform((current) => ({
      ...current,
      x: Math.min(92, Math.max(8, dragRef.current!.originX + dx)),
      y: Math.min(92, Math.max(8, dragRef.current!.originY + dy))
    }));
    setSelectedLookId("");
    setCompareLookId("");
  }

  function onOverlayPointerUp(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  // Handle (corner) drag → resize
  function onHandlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const cx = rect.left + (transform.x / 100) * rect.width;
    const cy = rect.top + (transform.y / 100) * rect.height;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    handleDragRef.current = {
      startDist: Math.sqrt(dx * dx + dy * dy),
      startScale: transform.scale
    };
  }

  function onHandlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (!handleDragRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const cx = rect.left + (transform.x / 100) * rect.width;
    const cy = rect.top + (transform.y / 100) * rect.height;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const newScale = (dist / handleDragRef.current.startDist) * handleDragRef.current.startScale;
    setTransform((current) => ({
      ...current,
      scale: Math.min(1.8, Math.max(0.55, newScale))
    }));
    setSelectedLookId("");
    setCompareLookId("");
  }

  function onHandlePointerUp(event: PointerEvent<HTMLSpanElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    handleDragRef.current = null;
  }

  // Thumbnail selection: first tap = primary, second different = compare
  function onThumbClick(id: string) {
    if (id === selectedLookId) {
      setSelectedLookId(compareLookId);
      setCompareLookId("");
      return;
    }
    if (id === compareLookId) {
      setCompareLookId("");
      return;
    }
    if (!selectedLookId) {
      setSelectedLookId(id);
      return;
    }
    setCompareLookId(id);
  }

  return (
    <main className="appShell">
      <input ref={photoInputRef} accept="image/*" className="hiddenInput" type="file" onChange={onPhotoChange} />

      <header className="topBar">
        <button aria-label="초기화" className="iconButton" type="button" onClick={resetOverlay}>
          <RefreshCcw size={20} />
        </button>
        <h1>대보기</h1>
        <button aria-label="카메라 시작" className="iconButton" type="button" onClick={startCamera}>
          <Camera size={20} />
        </button>
      </header>

      <section className="stageWrap" aria-label="착장 캔버스">
        <div ref={stageRef} className="stage">
          {selectedLook && compareLook ? (
            <div className="compareView">
              <img alt="비교 A" className="compareImg" src={selectedLook.image} />
              <div className="compareDivider" />
              <img alt="비교 B" className="compareImg" src={compareLook.image} />
            </div>
          ) : selectedLook ? (
            <img alt="저장한 비교" className="stagePhoto" src={selectedLook.image} />
          ) : photo ? (
            <img alt="내 사진" className="stagePhoto" src={photo} />
          ) : (
            <button className="emptyStage" type="button" onClick={() => photoInputRef.current?.click()}>
              <ImagePlus size={30} />
              <strong>사진</strong>
            </button>
          )}

          {!selectedLook && photo ? (
            <div
              className="overlayFrame"
              style={{
                left: `${transform.x}%`,
                top: `${transform.y}%`,
                opacity: transform.opacity,
                transform: `translate(-50%, -50%) rotate(${transform.rotate}deg) scale(${transform.scale})`
              }}
              onPointerDown={onOverlayPointerDown}
              onPointerMove={onOverlayPointerMove}
              onPointerUp={onOverlayPointerUp}
            >
              {activeOverlay ? (
                <img alt="옷 레이어" src={activeOverlay} />
              ) : (
                <video ref={videoRef} autoPlay muted playsInline />
              )}
              <span
                className="handle topLeft"
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
              />
              <span
                className="handle topRight"
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
              />
              <span
                className="handle bottomLeft"
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
              />
              <span
                className="handle bottomRight"
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
              />
            </div>
          ) : null}
        </div>

        {cameraError ? <p className="notice">{cameraError}</p> : null}
      </section>

      <section className="controlDock" aria-label="조작">
        <div className="toolRow">
          <ControlButton label="사진" onClick={() => photoInputRef.current?.click()}>
            <ImagePlus size={24} />
          </ControlButton>
          <ControlButton active={cameraReady && !frozenFrame} label="카메라" onClick={startCamera}>
            <Camera size={24} />
          </ControlButton>
          <ControlButton active={Boolean(frozenFrame)} label="고정" onClick={freezeFrame}>
            <Snowflake size={24} />
          </ControlButton>
          <ControlButton label="저장" onClick={saveLook}>
            <Save size={24} />
          </ControlButton>
          <ControlButton
            active={Boolean(selectedLook && compareLook)}
            label="비교"
            onClick={() => {
              if (savedLooks.length >= 2) {
                setSelectedLookId(savedLooks[0].id);
                setCompareLookId(savedLooks[1].id);
              } else if (savedLooks.length === 1) {
                setSelectedLookId(savedLooks[0].id);
                setCompareLookId("");
              }
            }}
          >
            <Layers2 size={24} />
          </ControlButton>
        </div>

        <div className="sliders">
          <label>
            <span>크기</span>
            <input
              aria-label="크기"
              max="1.8"
              min="0.55"
              step="0.01"
              type="range"
              value={transform.scale}
              onChange={(event) => updateTransform("scale", Number(event.target.value))}
            />
            <b>{Math.round(transform.scale * 100)}%</b>
          </label>
          <label>
            <span>회전</span>
            <input
              aria-label="회전"
              max="180"
              min="-180"
              step="1"
              type="range"
              value={transform.rotate}
              onChange={(event) => updateTransform("rotate", Number(event.target.value))}
            />
            <b>{transform.rotate}°</b>
          </label>
          <label>
            <span>투명도</span>
            <input
              aria-label="투명도"
              max="1"
              min="0.25"
              step="0.01"
              type="range"
              value={transform.opacity}
              onChange={(event) => updateTransform("opacity", Number(event.target.value))}
            />
            <b>{Math.round(transform.opacity * 100)}%</b>
          </label>
        </div>

        <div className="compareHead">
          <strong>비교</strong>
          <span>{savedLooks.length} / 8</span>
        </div>

        <div className="compareStrip" aria-label="저장한 비교">
          {savedLooks.map((look) => (
            <button
              key={look.id}
              className={
                selectedLookId === look.id
                  ? "thumb selected"
                  : compareLookId === look.id
                    ? "thumb compare"
                    : "thumb"
              }
              type="button"
              onClick={() => onThumbClick(look.id)}
            >
              <img alt="저장한 착장" src={look.image} />
            </button>
          ))}
          {Array.from({ length: Math.max(0, 4 - savedLooks.length) }).map((_, index) => (
            <div key={index} aria-hidden="true" className="thumb empty">
              <Shirt size={24} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
