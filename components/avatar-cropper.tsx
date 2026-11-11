"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

const STAGE_SIZE = 280;

function clampOffset(value: number, imageSize: number, stageSize: number) {
  const maxOffset = Math.max(0, (imageSize - stageSize) / 2);
  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

export function AvatarCropper({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (croppedFile: File) => void;
}) {
  const [objectUrl, setObjectUrl] = useState("");
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState(STAGE_SIZE);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scale = dimensions
    ? Math.max(stageSize / dimensions.width, stageSize / dimensions.height) * zoom
    : 1;
  const renderedWidth = (dimensions?.width ?? 0) * scale;
  const renderedHeight = (dimensions?.height ?? 0) * scale;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      setStageSize(stage.getBoundingClientRect().width);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions) return;
    const currentScale = Math.max(stageSize / dimensions.width, stageSize / dimensions.height) * zoom;
    setOffset((current) => ({
      x: clampOffset(current.x, dimensions.width * currentScale, stageSize),
      y: clampOffset(current.y, dimensions.height * currentScale, stageSize),
    }));
  }, [dimensions, stageSize, zoom]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!dimensions) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    setOffset({
      x: clampOffset(start.offsetX + event.clientX - start.x, renderedWidth, stageSize),
      y: clampOffset(start.offsetY + event.clientY - start.y, renderedHeight, stageSize),
    });
  }

  function changeZoom(value: number) {
    setZoom(value);
    if (!dimensions) return;
    const nextScale = Math.max(stageSize / dimensions.width, stageSize / dimensions.height) * value;
    setOffset((current) => ({
      x: clampOffset(current.x, dimensions.width * nextScale, stageSize),
      y: clampOffset(current.y, dimensions.height * nextScale, stageSize),
    }));
  }

  function saveCrop() {
    if (!dimensions || !objectUrl) return;
    const cropSize = stageSize / scale;
    const sourceX = (dimensions.width - cropSize) / 2 - offset.x / scale;
    const sourceY = (dimensions.height - cropSize) / 2 - offset.y / scale;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível preparar o recorte da imagem.");
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Não foi possível gerar a foto recortada.");
          return;
        }
        onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.9);
    };
    image.onerror = () => setError("Não foi possível ler a imagem selecionada.");
    image.src = objectUrl;
  }

  return (
    <div className="avatar-crop-backdrop">
      <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
        <h2 id="avatar-crop-title">Ajustar foto de perfil</h2>
        <p>Arraste a foto para posicionar e ajuste o zoom. A área dentro do círculo será usada.</p>
        <div
          className="avatar-crop-stage"
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragStart.current = null; }}
          onPointerCancel={() => { dragStart.current = null; }}
        >
          {objectUrl && (
            <img
              className="avatar-crop-image"
              src={objectUrl}
              alt="Prévia da foto que será recortada"
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setDimensions({ width: naturalWidth, height: naturalHeight });
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              onError={() => setError("Não foi possível abrir a imagem selecionada.")}
              style={{
                width: dimensions ? renderedWidth : "auto",
                height: dimensions ? renderedHeight : "auto",
                left: `calc(50% + ${offset.x}px)`,
                top: `calc(50% + ${offset.y}px)`,
              }}
            />
          )}
          <div className="avatar-crop-circle" aria-hidden="true" />
        </div>
        <label className="label avatar-crop-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="avatar-crop-actions">
          <button className="button button-outline" type="button" onClick={onCancel}>Cancelar</button>
          <button className="button button-primary" type="button" disabled={!dimensions} onClick={saveCrop}>
            Usar esta foto
          </button>
        </div>
      </section>
    </div>
  );
}
