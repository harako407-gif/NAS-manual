"use client";
/* eslint-disable @next/next/no-img-element -- uploaded offline data URLs cannot use the image optimizer */

import type { ChangeEvent, CSSProperties, DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import defaultManualData from "../data/manual.json";
import { deleteAsset, deletePreference, getAllAssets, getPreference, putAsset, putPreference, replaceAllAssets } from "../lib/media-db";
import type {
  ManualAsset,
  ManualBackup,
  ManualDocument,
  ManualMedia,
  ManualSection,
  ManualSource,
  ManualStep,
  ValidationIssue,
} from "../lib/manual-types";
import { generateStaticHtml } from "../lib/static-export.mjs";

const STORAGE_KEY = "synology-manual-document-v3";
const JSON_AUTO_SAVE_HANDLE_KEY = "json-auto-save-handle";
const DEFAULT_MANUAL = defaultManualData as ManualDocument;
const ALLOWED_MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const CALLOUT_LABELS: Record<string, string> = { info: "참고", tip: "팁", warning: "주의", danger: "중요" };
type TextSettingKey = { [K in keyof ManualDocument["settings"]]-?: ManualDocument["settings"][K] extends string ? K : never }[keyof ManualDocument["settings"]];
type JsonFileHandle = {
  name: string;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
};
type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<JsonFileHandle>;
};

const cloneDefault = () => structuredClone(DEFAULT_MANUAL);
const upgradeManual = (manual: ManualDocument): ManualDocument => ({
  ...manual,
  settings: { ...DEFAULT_MANUAL.settings, ...manual.settings },
  quickLinks: manual.quickLinks.map((item) => ({ ...item, hint: item.hint || "단계별로 보기" })),
});
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR");
const uniqueId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
const createEmptyMedia = (): ManualMedia => ({
  id: uniqueId("MEDIA"),
  label: "새 단계 화면",
  format: "PNG 또는 GIF",
  alt: "이 단계의 화면 설명",
  caption: "화면에서 확인할 내용을 입력하세요.",
  captureGuide: "사진 또는 GIF를 업로드하세요.",
});

function downloadFile(content: BlobPart, filename: string, type: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function writeBackupToHandle(handle: JsonFileHandle, backup: ManualBackup) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(backup, null, 2));
  await writable.close();
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

async function loadBundledAssets(manual: ManualDocument): Promise<ManualAsset[]> {
  const sources = new Set<string>();
  if (manual.settings.brandLogo) sources.add(manual.settings.brandLogo);
  for (const section of manual.sections) {
    for (const step of section.steps) {
      if (step.media?.src) sources.add(step.media.src);
    }
  }

  const bundled: ManualAsset[] = [];
  for (const src of sources) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`기본 사진을 읽지 못했습니다: ${src}`);
    const blob = await response.blob();
    bundled.push({
      id: src,
      name: src.split("/").pop() || "manual-image",
      type: blob.type || "image/png",
      size: blob.size,
      dataUrl: await readDataUrl(blob),
      updatedAt: new Date().toISOString(),
    });
  }
  return bundled;
}

function isManualDocument(value: unknown): value is ManualDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ManualDocument>;
  return candidate.schemaVersion === 1 && Boolean(candidate.settings) && Array.isArray(candidate.sections);
}

function renumberSections(sections: ManualSection[]) {
  return sections.map((section, index) => ({ ...section, number: String(index + 1).padStart(2, "0") }));
}

function validateManual(manual: ManualDocument, assets: Record<string, ManualAsset>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredSettings: Array<[TextSettingKey, string]> = [
    ["nasAddress", "NAS 주소"],
    ["driveWebUrl", "Drive 웹 주소"],
    ["teamFolder", "Team Folder"],
    ["localFolder", "내 PC 폴더"],
    ["support", "문의처"],
  ];
  for (const [key, label] of requiredSettings) {
    const value = manual.settings[key];
    if (!value || value.includes("[")) {
      issues.push({ level: "warning", message: `${label}에 실제 회사 값이 아직 입력되지 않았습니다.`, target: "문서 설정" });
    }
  }

  const ids = new Set<string>();
  for (const section of manual.sections) {
    if (ids.has(section.id)) issues.push({ level: "error", message: `중복된 장 ID가 있습니다: ${section.id}`, target: section.title });
    ids.add(section.id);
    if (!section.title.trim()) issues.push({ level: "error", message: "제목이 비어 있는 장이 있습니다.", target: section.number });
    for (const step of section.steps) {
      if (ids.has(step.id)) issues.push({ level: "error", message: `중복된 단계 ID가 있습니다: ${step.id}`, target: section.title });
      ids.add(step.id);
      if (!step.title.trim()) issues.push({ level: "error", message: "단계 제목이 비어 있습니다.", target: section.title });
      if (step.media) {
        if (!step.media.alt.trim()) issues.push({ level: "error", message: `${step.media.label}의 대체 텍스트가 비어 있습니다.`, target: section.title });
        if (!step.media.assetId && !step.media.src) {
          issues.push({ level: "warning", message: `${step.media.label} 미디어가 아직 자리표시자입니다.`, target: section.title });
        } else if (step.media.assetId && !assets[step.media.assetId]) {
          issues.push({ level: "error", message: `${step.media.label}가 존재하지 않는 미디어를 참조합니다.`, target: section.title });
        }
        if (step.media.baseAssetId && !assets[step.media.baseAssetId]) {
          issues.push({ level: "error", message: `${step.media.label}의 원본 사진을 찾을 수 없습니다.`, target: section.title });
        }
      }
    }
  }
  return issues;
}

function FontSizeControl({ value, fallback, onChange }: { value?: number; fallback: number; onChange: (value?: number) => void }) {
  return <span className="font-size-control"><span>글자</span><input type="number" min="9" max="96" value={value ?? ""} placeholder={String(fallback)} onChange={(event) => onChange(event.target.value ? Math.max(9, Math.min(96, Number(event.target.value))) : undefined)} aria-label="글자 크기" /><span>px</span><button type="button" onClick={() => onChange(undefined)} disabled={value === undefined}>기본</button></span>;
}

type MediaBlockProps = {
  media: ManualMedia;
  asset?: ManualAsset;
  editMode: boolean;
  onChange: (patch: Partial<ManualMedia>) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onDeleteSlot: () => void;
  onAnnotate: () => void;
  onZoom: () => void;
};

function MediaBlock({ media, asset, editMode, onChange, onUpload, onRemove, onDeleteSlot, onAnnotate, onZoom }: MediaBlockProps) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  };

  const displaySrc = asset?.dataUrl || media.src;

  if (displaySrc) {
    return (
      <figure className="media-frame">
        <button type="button" className="media-image-button" onClick={onZoom} aria-label={`${media.alt} 크게 보기`}>
          <img src={displaySrc} alt={media.alt} loading="lazy" />
        </button>
        <figcaption>
          {editMode ? (
            <>
              <div className="editable-field"><div><span>미디어 제목</span><FontSizeControl value={media.labelFontSize} fallback={15} onChange={(value) => onChange({ labelFontSize: value })} /></div><input value={media.label} onChange={(event) => onChange({ label: event.target.value })} /></div>
              <label>대체 텍스트<input value={media.alt} onChange={(event) => onChange({ alt: event.target.value })} /></label>
              <div className="editable-field"><div><span>설명</span><FontSizeControl value={media.captionFontSize} fallback={15} onChange={(value) => onChange({ captionFontSize: value })} /></div><textarea rows={2} value={media.caption} onChange={(event) => onChange({ caption: event.target.value })} /></div>
              <div className="media-actions">
                <label className="small-button file-button">교체<input type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={handleFile} /></label>
                <button type="button" className="small-button" onClick={onAnnotate}>사진 주석 편집</button>
                <button type="button" className="small-button danger-button" onClick={onRemove}>{asset && (media.baseAssetId || media.src) ? "편집본 제거·원본 복원" : asset ? "업로드 이미지 제거" : "기본 사진 제거"}</button>
                <button type="button" className="small-button danger-button" onClick={onDeleteSlot}>사진 영역 삭제</button>
                <span>{asset ? `${asset.name} · ${(asset.size / 1024 / 1024).toFixed(1)}MB` : "기본 제공 사진"}</span>
              </div>
            </>
          ) : (
            <><strong style={media.labelFontSize ? { fontSize: `${media.labelFontSize}px` } : undefined}>{media.label}</strong><span style={media.captionFontSize ? { fontSize: `${media.captionFontSize}px` } : undefined}>{media.caption}</span></>
          )}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`media-placeholder ${editMode ? "editing" : ""}`}>
      <div className="placeholder-preview" aria-hidden="true">
        <span className="format-mark">{media.format}</span>
        <div><Skeleton height={10} width="72%" /><Skeleton height={8} width="92%" /><Skeleton height={8} width="64%" /></div>
      </div>
      <figcaption>
        {editMode ? (
          <>
            <div className="editable-field"><div><span>자리 제목</span><FontSizeControl value={media.labelFontSize} fallback={15} onChange={(value) => onChange({ labelFontSize: value })} /></div><input value={media.label} onChange={(event) => onChange({ label: event.target.value })} /></div>
            <label>권장 형식<input value={media.format} onChange={(event) => onChange({ format: event.target.value })} /></label>
            <label>대체 텍스트<input value={media.alt} onChange={(event) => onChange({ alt: event.target.value })} /></label>
            <div className="editable-field"><div><span>촬영 안내</span><FontSizeControl value={media.captionFontSize} fallback={15} onChange={(value) => onChange({ captionFontSize: value })} /></div><textarea rows={2} value={media.captureGuide} onChange={(event) => onChange({ captureGuide: event.target.value })} /></div>
            <label className="upload-button">사진·GIF 넣기<input type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={handleFile} /></label>
            <button type="button" className="small-button danger-button" onClick={onDeleteSlot}>사진 영역 삭제</button>
          </>
        ) : (
          <><strong style={media.labelFontSize ? { fontSize: `${media.labelFontSize}px` } : undefined}>이미지 준비 중 · {media.label}</strong><span style={media.captionFontSize ? { fontSize: `${media.captionFontSize}px` } : undefined}>{media.captureGuide}</span></>
        )}
      </figcaption>
    </figure>
  );
}

type AnnotationTool = "pen" | "rect" | "ellipse" | "arrow" | "text";

type AnnotationEditorProps = {
  src: string;
  baseSrc?: string;
  alt: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
};

function AnnotationEditor({ src, baseSrc, alt, onCancel, onSave }: AnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);
  const originalRef = useRef("");
  const [tool, setTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState("#ef2b2d");
  const [lineWidth, setLineWidth] = useState(6);
  const [fontSize, setFontSize] = useState(34);
  const [textValue, setTextValue] = useState("클릭");
  const [history, setHistory] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const drawDataUrl = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.onload = () => {
      const maxDimension = 2800;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const initial = canvas.toDataURL("image/png");
      originalRef.current = baseSrc || initial;
      setHistory([initial]);
      setReady(true);
    };
    image.onerror = () => setReady(false);
    image.src = src;
  }, [src, baseSrc]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  const prepareContext = () => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return null;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    return context;
  };

  const drawShape = (context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (tool === "rect") {
      context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      return;
    }
    if (tool === "ellipse") {
      context.beginPath();
      context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
      context.stroke();
      return;
    }
    if (tool === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const head = Math.max(18, lineWidth * 4);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
      context.stroke();
    }
  };

  const commitHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = canvas.toDataURL("image/png");
    setHistory((current) => [...current, snapshot].slice(-10));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const canvas = canvasRef.current!;
    const context = prepareContext();
    if (!context) return;
    const point = pointFromEvent(event);
    if (tool === "text") {
      if (!textValue.trim()) return;
      context.font = `700 ${fontSize}px "Malgun Gothic", sans-serif`;
      context.textBaseline = "top";
      context.fillText(textValue, point.x, point.y);
      commitHistory();
      return;
    }
    drawingRef.current = true;
    startRef.current = point;
    snapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
    if (tool === "pen") {
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = prepareContext();
    if (!context) return;
    const point = pointFromEvent(event);
    if (tool === "pen") {
      context.lineTo(point.x, point.y);
      context.stroke();
      return;
    }
    if (snapshotRef.current) context.putImageData(snapshotRef.current, 0, 0);
    drawShape(context, startRef.current, point);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    snapshotRef.current = null;
    canvasRef.current?.releasePointerCapture(event.pointerId);
    commitHistory();
  };

  const undo = () => {
    if (history.length <= 1) return;
    const next = history.slice(0, -1);
    setHistory(next);
    drawDataUrl(next[next.length - 1]);
  };

  const reset = () => {
    if (!originalRef.current) return;
    setHistory([originalRef.current]);
    drawDataUrl(originalRef.current);
  };

  return (
    <div className="annotation-backdrop" role="presentation">
      <section className="annotation-editor" role="dialog" aria-modal="true" aria-label={`${alt} 주석 편집`}>
        <header><div><p>사진 주석 편집</p><h2>도형·화살표·텍스트를 사진에 추가합니다</h2></div><button type="button" onClick={onCancel} aria-label="닫기">×</button></header>
        <div className="annotation-toolbar">
          <div className="annotation-tools" role="group" aria-label="그리기 도구">
            {([['arrow','화살표'],['rect','사각형'],['ellipse','원'],['pen','자유선'],['text','텍스트']] as Array<[AnnotationTool,string]>).map(([value, label]) => <button type="button" className={tool === value ? "active" : ""} onClick={() => setTool(value)} key={value}>{label}</button>)}
          </div>
          <label>색상<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <label>선 굵기<input type="range" min="2" max="24" value={lineWidth} onChange={(event) => setLineWidth(Number(event.target.value))} /><span>{lineWidth}px</span></label>
          <label>글자 크기<input type="range" min="18" max="96" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><span>{fontSize}px</span></label>
          <label className="annotation-text-input">넣을 글자<input value={textValue} onChange={(event) => setTextValue(event.target.value)} /></label>
          <div className="annotation-history"><button type="button" onClick={undo} disabled={history.length <= 1}>실행 취소</button><button type="button" onClick={reset}>원본으로 되돌리기</button></div>
        </div>
        <div className="annotation-stage"><canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="사진 주석 그리기 영역" /></div>
        <footer><button type="button" onClick={onCancel}>취소</button><button type="button" className="annotation-save" disabled={!ready} onClick={() => { const canvas = canvasRef.current; if (canvas) onSave(canvas.toDataURL("image/png")); }}>사진에 적용</button></footer>
      </section>
    </div>
  );
}

export default function Home() {
  const [manual, setManual] = useState<ManualDocument>(cloneDefault);
  const [assets, setAssets] = useState<Record<string, ManualAsset>>({});
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveLabel, setSaveLabel] = useState("불러오는 중");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [toast, setToast] = useState("");
  const [zoomedAsset, setZoomedAsset] = useState<ManualAsset | null>(null);
  const [annotationTarget, setAnnotationTarget] = useState<{ sectionId: string; stepId: string } | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedQuickIndex, setDraggedQuickIndex] = useState<number | null>(null);
  const [draggedStep, setDraggedStep] = useState<{ sectionId: string; stepId: string } | null>(null);
  const [jsonAutoSaveHandle, setJsonAutoSaveHandle] = useState<JsonFileHandle | null>(null);
  const [jsonAutoSaveStatus, setJsonAutoSaveStatus] = useState("자동 저장 꺼짐");
  const [jsonAutoSaveRevision, setJsonAutoSaveRevision] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_MANUAL.sections[0]?.id || "");
  const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(() => new Set());
  const [motionReady, setMotionReady] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const activeSectionRef = useRef(DEFAULT_MANUAL.sections[0]?.id || "");

  useEffect(() => {
    let active = true;
    async function loadDraft() {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as unknown;
          if (isManualDocument(parsed) && active) setManual(upgradeManual(parsed));
        }
        const [storedAssets, storedHandle] = await Promise.all([getAllAssets(), getPreference<JsonFileHandle>(JSON_AUTO_SAVE_HANDLE_KEY)]);
        if (active) setAssets(Object.fromEntries(storedAssets.map((asset) => [asset.id, asset])));
        if (active && storedHandle) {
          setJsonAutoSaveHandle(storedHandle);
          try {
            const permission = storedHandle.queryPermission ? await storedHandle.queryPermission({ mode: "readwrite" }) : "granted";
            setJsonAutoSaveStatus(permission === "granted" ? `자동 저장 연결됨 · ${storedHandle.name}` : `권한 확인 필요 · ${storedHandle.name}`);
          } catch {
            setJsonAutoSaveStatus(`권한 확인 필요 · ${storedHandle.name}`);
          }
        }
      } catch {
        if (active) setToast("저장된 초안을 불러오지 못해 기본 매뉴얼을 열었습니다.");
      } finally {
        if (active) {
          setHydrated(true);
          setSaveLabel("저장됨");
        }
      }
    }
    void loadDraft();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manual));
        setSaveLabel(`저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setSaveLabel("저장 공간 부족");
        setToast("문서 저장 공간이 부족합니다. JSON 백업 후 큰 미디어를 줄여 주세요.");
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [hydrated, manual]);

  useEffect(() => {
    if (!hydrated || !jsonAutoSaveHandle) return;
    const timer = window.setTimeout(async () => {
      try {
        const permission = jsonAutoSaveHandle.queryPermission ? await jsonAutoSaveHandle.queryPermission({ mode: "readwrite" }) : "granted";
        if (permission !== "granted") {
          setJsonAutoSaveStatus(`권한 확인 필요 · ${jsonAutoSaveHandle.name}`);
          return;
        }
        setJsonAutoSaveStatus(`JSON 저장 중 · ${jsonAutoSaveHandle.name}`);
        await writeBackupToHandle(jsonAutoSaveHandle, { schemaVersion: 1, exportedAt: new Date().toISOString(), manual, assets: Object.values(assets) });
        setJsonAutoSaveStatus(`JSON 저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · ${jsonAutoSaveHandle.name}`);
      } catch {
        setJsonAutoSaveStatus(`자동 저장 오류 · ${jsonAutoSaveHandle.name}`);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [assets, hydrated, jsonAutoSaveHandle, jsonAutoSaveRevision, manual]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleSections = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return manual.sections;
    return manual.sections.filter((section) => normalize(JSON.stringify(section)).includes(term));
  }, [manual.sections, query]);
  const sectionOrderKey = useMemo(() => manual.sections.map((section) => section.id).join("|"), [manual.sections]);

  const annotationStep = useMemo(() => {
    if (!annotationTarget) return null;
    return manual.sections.find((section) => section.id === annotationTarget.sectionId)?.steps.find((step) => step.id === annotationTarget.stepId) || null;
  }, [annotationTarget, manual.sections]);
  const annotationAsset = annotationStep?.media?.assetId ? assets[annotationStep.media.assetId] : undefined;
  const annotationSrc = annotationAsset?.dataUrl || annotationStep?.media?.src || "";
  const annotationBaseAsset = annotationStep?.media?.baseAssetId ? assets[annotationStep.media.baseAssetId] : undefined;
  const annotationBaseSrc = annotationBaseAsset?.dataUrl || annotationStep?.media?.src || annotationSrc;

  useEffect(() => {
    const sectionIds = sectionOrderKey.split("|").filter(Boolean);
    const elements = sectionIds.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const markActive = (id: string) => {
      if (!id) return;
      const changed = activeSectionRef.current !== id;
      activeSectionRef.current = id;
      if (changed) setActiveSectionId(id);
      window.requestAnimationFrame(() => {
        const sidebar = document.querySelector<HTMLElement>(".sidebar");
        const activeLink = sidebar?.querySelector<HTMLElement>(`a[href="#${id}"]`);
        if (!sidebar || !activeLink) return;
        const sidebarRect = sidebar.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const targetTop = sidebar.scrollTop + linkRect.top - sidebarRect.top - sidebar.clientHeight / 2 + linkRect.height / 2;
        sidebar.scrollTo({ top: Math.max(0, targetTop), behavior: reducedMotion ? "auto" : "smooth" });
      });
    };

    const updateLocation = () => {
      const marker = Math.min(260, window.innerHeight * .32);
      let nextId = elements[0].id;
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= marker) nextId = element.id;
        else break;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) nextId = elements[elements.length - 1].id;
      markActive(nextId);
    };

    let scrollFrame = 0;
    const handleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        updateLocation();
      });
    };

    const frame = window.requestAnimationFrame(() => {
      setMotionReady(true);
      setVisibleSectionIds(new Set(reducedMotion ? sectionIds : elements.filter((element) => element.getBoundingClientRect().top < window.innerHeight * .94).map((element) => element.id)));
      const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (hashId && sectionIds.includes(hashId)) markActive(hashId);
      else updateLocation();
    });

    const revealObserver = reducedMotion ? null : new IntersectionObserver((entries) => {
      const newlyVisible = entries.filter((entry) => entry.isIntersecting).map((entry) => (entry.target as HTMLElement).id);
      if (!newlyVisible.length) return;
      setVisibleSectionIds((current) => new Set([...current, ...newlyVisible]));
      for (const entry of entries) if (entry.isIntersecting) revealObserver?.unobserve(entry.target);
    }, { threshold: .06, rootMargin: "0px 0px -8% 0px" });

    if (revealObserver) for (const element of elements) revealObserver.observe(element);
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      revealObserver?.disconnect();
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [sectionOrderKey]);

  const setSetting = <K extends keyof ManualDocument["settings"]>(key: K, value: ManualDocument["settings"][K]) => {
    setManual((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  };

  const updateQuickLink = (index: number, patch: Partial<ManualDocument["quickLinks"][number]>) => {
    setManual((current) => ({
      ...current,
      quickLinks: current.quickLinks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const moveQuickLink = (index: number, direction: -1 | 1) => {
    setManual((current) => {
      const quickLinks = [...current.quickLinks];
      const target = index + direction;
      if (target < 0 || target >= quickLinks.length) return current;
      [quickLinks[index], quickLinks[target]] = [quickLinks[target], quickLinks[index]];
      return { ...current, quickLinks };
    });
  };

  const reorderQuickLinks = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    setManual((current) => {
      const quickLinks = [...current.quickLinks];
      const [moved] = quickLinks.splice(sourceIndex, 1);
      quickLinks.splice(targetIndex, 0, moved);
      return { ...current, quickLinks };
    });
  };

  const addQuickLink = () => {
    setManual((current) => ({
      ...current,
      quickLinks: [...current.quickLinks, { icon: String(current.quickLinks.length + 1).padStart(2, "0"), label: "새 빠른 메뉴", hint: "단계별로 보기", sectionId: current.sections[0]?.id || "start" }],
    }));
  };

  const removeQuickLink = (index: number) => {
    if (!window.confirm("이 빠른 메뉴를 삭제할까요?")) return;
    setManual((current) => ({ ...current, quickLinks: current.quickLinks.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const updateSection = (sectionId: string, patch: Partial<ManualSection>) => {
    setManual((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) }));
  };

  const updateSource = (sectionId: string, sourceIndex: number, patch: Partial<ManualSource>) => {
    setManual((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId
        ? { ...section, sources: (section.sources || []).map((source, index) => index === sourceIndex ? { ...source, ...patch } : source) }
        : section),
    }));
  };

  const addSource = (sectionId: string) => {
    setManual((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, sources: [...(section.sources || []), { label: "새 참고자료", url: "https://" }] } : section) }));
  };

  const removeSource = (sectionId: string, sourceIndex: number) => {
    setManual((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, sources: (section.sources || []).filter((_, index) => index !== sourceIndex) } : section) }));
  };

  const updateStep = (sectionId: string, stepId: string, patch: Partial<ManualStep>) => {
    setManual((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId
        ? { ...section, steps: section.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step) }
        : section),
    }));
  };

  const updateMedia = (sectionId: string, step: ManualStep, patch: Partial<ManualMedia>) => {
    if (!step.media) return;
    updateStep(sectionId, step.id, { media: { ...step.media, ...patch } });
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setManual((current) => {
      const sections = [...current.sections];
      const index = sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.length) return current;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections: renumberSections(sections) };
    });
  };

  const reorderSections = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setManual((current) => {
      const sections = [...current.sections];
      const sourceIndex = sections.findIndex((section) => section.id === sourceId);
      const targetIndex = sections.findIndex((section) => section.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = sections.splice(sourceIndex, 1);
      sections.splice(targetIndex, 0, moved);
      return { ...current, sections: renumberSections(sections) };
    });
  };

  const moveStep = (sectionId: string, stepId: string, direction: -1 | 1) => {
    setManual((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const steps = [...section.steps];
        const index = steps.findIndex((step) => step.id === stepId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= steps.length) return section;
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { ...section, steps };
      }),
    }));
  };

  const reorderSteps = (sectionId: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setManual((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const steps = [...section.steps];
        const sourceIndex = steps.findIndex((step) => step.id === sourceId);
        const targetIndex = steps.findIndex((step) => step.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return section;
        const [moved] = steps.splice(sourceIndex, 1);
        steps.splice(targetIndex, 0, moved);
        return { ...section, steps };
      }),
    }));
  };

  const addSection = () => {
    const section: ManualSection = {
      id: uniqueId("section"), number: "", eyebrow: "새 안내", title: "새 안내 제목",
      summary: "이 장에서 안내할 내용을 입력하세요.", audience: "일반 사용자",
      platforms: ["PC"], duration: "약 3분", sources: [],
      steps: [{ id: uniqueId("step"), title: "첫 번째 단계", body: "단계 설명을 입력하세요.", bullets: ["확인할 항목을 입력하세요."], media: createEmptyMedia() }],
    };
    setManual((current) => ({ ...current, sections: renumberSections([...current.sections, section]) }));
    setQuery("");
    window.setTimeout(() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const addStep = (sectionId: string) => {
    const step: ManualStep = { id: uniqueId("step"), title: "새 단계", body: "이 단계의 설명을 입력하세요.", bullets: ["확인할 항목"], media: createEmptyMedia() };
    setManual((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, steps: [...section.steps, step] } : section) }));
  };

  const removeSection = (sectionId: string) => {
    if (!window.confirm("이 장과 모든 단계를 삭제할까요?")) return;
    setManual((current) => ({ ...current, sections: renumberSections(current.sections.filter((section) => section.id !== sectionId)) }));
  };

  const removeStep = (sectionId: string, stepId: string) => {
    if (!window.confirm("이 단계를 삭제할까요?")) return;
    setManual((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, steps: section.steps.filter((step) => step.id !== stepId) } : section) }));
  };

  const updateBrandLogo = async (file: File) => {
    if (!ALLOWED_MEDIA.has(file.type)) {
      setToast("로고는 PNG, JPG 또는 WebP 파일만 사용할 수 있습니다.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast("로고 파일은 2MB 이하로 줄여 주세요.");
      return;
    }
    setSetting("brandLogo", await readDataUrl(file));
    setToast("상단 로고를 교체했습니다.");
  };

  const uploadMedia = async (sectionId: string, step: ManualStep, file: File) => {
    if (!step.media) return;
    if (!ALLOWED_MEDIA.has(file.type)) {
      setToast("PNG, JPG, WebP, GIF 파일만 넣을 수 있습니다. SVG는 보안상 차단됩니다.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setToast("25MB보다 큰 파일입니다. GIF 길이나 해상도를 줄인 뒤 다시 시도해 주세요.");
      return;
    }
    try {
      const previousId = step.media.assetId;
      const previousBaseId = step.media.baseAssetId;
      const asset: ManualAsset = {
        id: uniqueId("asset"), name: file.name, type: file.type, size: file.size,
        dataUrl: await readDataUrl(file), updatedAt: new Date().toISOString(),
      };
      await putAsset(asset);
      if (previousId) await deleteAsset(previousId);
      if (previousBaseId && previousBaseId !== previousId) await deleteAsset(previousBaseId);
      setAssets((current) => {
        const next = { ...current, [asset.id]: asset };
        if (previousId) delete next[previousId];
        if (previousBaseId) delete next[previousBaseId];
        return next;
      });
      updateMedia(sectionId, step, { assetId: asset.id, baseAssetId: undefined, format: file.type === "image/gif" ? "GIF" : "IMAGE" });
      setToast("미디어를 넣었습니다. 대체 텍스트와 설명을 확인해 주세요.");
    } catch {
      setToast("미디어를 저장하지 못했습니다. 브라우저 저장 권한과 여유 공간을 확인해 주세요.");
    }
  };

  const removeMedia = async (sectionId: string, step: ManualStep) => {
    const assetId = step.media?.assetId;
    const baseAssetId = step.media?.baseAssetId;
    const restoredAssetId = baseAssetId && baseAssetId !== assetId ? baseAssetId : undefined;
    const bundledSrc = step.media?.src;
    if ((!assetId && !bundledSrc) || !window.confirm(assetId && (baseAssetId || bundledSrc) ? "편집본을 제거하고 원본 사진으로 되돌릴까요?" : "이미지를 제거하고 자리표시자로 되돌릴까요?")) return;
    if (assetId) {
      await deleteAsset(assetId);
      setAssets((current) => { const next = { ...current }; delete next[assetId]; return next; });
      updateMedia(sectionId, step, { assetId: restoredAssetId, baseAssetId: undefined });
      setToast(restoredAssetId || bundledSrc ? "편집본을 제거하고 원본 사진으로 되돌렸습니다." : "이미지를 제거했습니다.");
    } else {
      updateMedia(sectionId, step, { src: undefined });
      setToast("기본 사진을 제거했습니다.");
    }
  };

  const deleteMediaSlot = async (sectionId: string, step: ManualStep) => {
    if (!step.media || !window.confirm("사진과 설명 영역 전체를 삭제할까요?")) return;
    const ids = [...new Set([step.media.assetId, step.media.baseAssetId].filter((value): value is string => Boolean(value)))];
    for (const id of ids) await deleteAsset(id);
    if (ids.length) setAssets((current) => { const next = { ...current }; for (const id of ids) delete next[id]; return next; });
    updateStep(sectionId, step.id, { media: undefined });
  };

  const saveAnnotation = async (dataUrl: string) => {
    if (!annotationTarget || !annotationStep?.media) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const previousId = annotationStep.media.assetId;
      const existingBaseId = annotationStep.media.baseAssetId;
      const baseAssetId = existingBaseId || previousId;
      const asset: ManualAsset = {
        id: uniqueId("asset"),
        name: `annotated-${annotationStep.media.id}.png`,
        type: "image/png",
        size: blob.size,
        dataUrl,
        updatedAt: new Date().toISOString(),
      };
      await putAsset(asset);
      if (existingBaseId && previousId && previousId !== existingBaseId) await deleteAsset(previousId);
      setAssets((current) => {
        const next = { ...current, [asset.id]: asset };
        if (existingBaseId && previousId && previousId !== existingBaseId) delete next[previousId];
        return next;
      });
      updateMedia(annotationTarget.sectionId, annotationStep, { assetId: asset.id, baseAssetId, format: "PNG" });
      setAnnotationTarget(null);
      setToast("사진 주석을 저장했습니다.");
    } catch {
      setToast("사진 주석을 저장하지 못했습니다.");
    }
  };

  const enableJsonAutoSave = async () => {
    const pickerWindow = window as SavePickerWindow;
    const picker = pickerWindow.showSaveFilePicker;
    if (!picker) {
      setToast("이 브라우저는 파일 자동 저장을 지원하지 않습니다. JSON 백업 버튼을 사용해 주세요.");
      return;
    }
    try {
      const handle = await picker.call(pickerWindow, {
        suggestedName: "synology-manual-autosave.json",
        types: [{ description: "Synology 매뉴얼 JSON 백업", accept: { "application/json": [".json"] } }],
      });
      await putPreference(JSON_AUTO_SAVE_HANDLE_KEY, handle);
      setJsonAutoSaveHandle(handle);
      await writeBackupToHandle(handle, { schemaVersion: 1, exportedAt: new Date().toISOString(), manual, assets: Object.values(assets) });
      setJsonAutoSaveStatus(`JSON 저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · ${handle.name}`);
      setToast("JSON 자동 저장을 시작했습니다.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setToast("JSON 자동 저장 파일을 연결하지 못했습니다.");
    }
  };

  const reconnectJsonAutoSave = async () => {
    if (!jsonAutoSaveHandle) return;
    try {
      const permission = jsonAutoSaveHandle.requestPermission ? await jsonAutoSaveHandle.requestPermission({ mode: "readwrite" }) : "granted";
      if (permission !== "granted") {
        setJsonAutoSaveStatus(`권한 확인 필요 · ${jsonAutoSaveHandle.name}`);
        return;
      }
      setJsonAutoSaveRevision((value) => value + 1);
      setJsonAutoSaveStatus(`자동 저장 연결됨 · ${jsonAutoSaveHandle.name}`);
    } catch {
      setJsonAutoSaveStatus(`권한 확인 필요 · ${jsonAutoSaveHandle.name}`);
    }
  };

  const disableJsonAutoSave = async () => {
    await deletePreference(JSON_AUTO_SAVE_HANDLE_KEY);
    setJsonAutoSaveHandle(null);
    setJsonAutoSaveStatus("자동 저장 꺼짐");
    setToast("JSON 자동 저장을 껐습니다.");
  };

  const makeBackup = (prefix = "synology-manual-backup") => {
    const backup: ManualBackup = { schemaVersion: 1, exportedAt: new Date().toISOString(), manual, assets: Object.values(assets) };
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(JSON.stringify(backup, null, 2), `${prefix}-${date}.json`, "application/json;charset=utf-8");
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ManualBackup>;
      if (parsed.schemaVersion !== 1 || !isManualDocument(parsed.manual) || !Array.isArray(parsed.assets)) throw new Error("schema");
      for (const asset of parsed.assets) {
        if (!ALLOWED_MEDIA.has(asset.type) || !asset.dataUrl.startsWith(`data:${asset.type};base64,`)) throw new Error("asset");
      }
      if (!window.confirm(`${parsed.manual.sections.length}개 장과 ${parsed.assets.length}개 미디어를 복원할까요? 현재 상태는 먼저 자동 백업됩니다.`)) return;
      makeBackup("synology-manual-before-restore");
      await replaceAllAssets(parsed.assets);
      setAssets(Object.fromEntries(parsed.assets.map((asset) => [asset.id, asset])));
      setManual(upgradeManual(parsed.manual));
      setQuery("");
      setToast("백업을 복원했습니다.");
    } catch {
      setToast("올바른 버전 1 매뉴얼 백업이 아닙니다. 현재 초안은 변경하지 않았습니다.");
    }
  };

  const runValidation = () => {
    const nextIssues = validateManual(manual, assets);
    setIssues(nextIssues);
    if (nextIssues.length === 0) setToast("검수 완료: 배포 전 확인 항목이 없습니다.");
  };

  const exportStatic = async () => {
    const nextIssues = validateManual(manual, assets);
    const errors = nextIssues.filter((issue) => issue.level === "error");
    if (errors.length) {
      setIssues(nextIssues);
      setToast("오류를 먼저 수정한 뒤 정적 HTML을 내보내 주세요.");
      return;
    }
    try {
      const bundledAssets = await loadBundledAssets(manual);
      const html = generateStaticHtml(manual, [...bundledAssets, ...Object.values(assets)]);
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(html, `synology-nas-manual-${date}.html`, "text/html;charset=utf-8");
      setToast(nextIssues.length ? `정적 HTML을 만들었습니다. 자리표시자 ${nextIssues.length}건을 최종 배포 전에 확인하세요.` : "정적 HTML을 만들었습니다.");
    } catch {
      setToast("기본 사진을 포함하지 못했습니다. 페이지를 새로고침한 뒤 다시 내보내 주세요.");
    }
  };

  const resetDraft = async () => {
    if (!window.confirm("현재 편집 내용과 미디어를 모두 지우고 기본 초안으로 되돌릴까요? 먼저 JSON 백업을 권장합니다.")) return;
    await replaceAllAssets([]);
    setAssets({});
    setManual(cloneDefault());
    setQuery("");
    setToast("기본 초안으로 되돌렸습니다.");
  };

  return (
    <div className={`site-shell ${editMode ? "is-editing" : ""} ${motionReady ? "motion-ready" : ""}`} style={{ "--font-scale": manual.settings.fontScale / 100 } as CSSProperties}>
      <a className="skip-link" href="#main">본문으로 바로가기</a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="매뉴얼 처음으로"><img className="brand-logo" src={manual.settings.brandLogo} alt={`${manual.settings.company} 로고`} />{manual.settings.showHeaderLabel && <span style={manual.settings.headerLabelFontSize ? { fontSize: `${manual.settings.headerLabelFontSize}px` } : undefined}>{manual.settings.headerLabel}</span>}</a>
        <div className="top-actions">
          <span className={`save-state ${saveLabel.includes("부족") ? "error" : ""}`}>{editMode ? saveLabel : manual.settings.version}</span>
          <button type="button" className="ghost-button print-button" onClick={() => window.print()}>인쇄</button>
          <button type="button" className="edit-button" onClick={() => setEditMode((value) => !value)}>{editMode ? "미리보기" : "편집 시작"}</button>
          <button type="button" className="mobile-nav-button" onClick={() => setMobileNavOpen((value) => !value)} aria-expanded={mobileNavOpen} aria-label="목차 열기">목차</button>
        </div>
      </header>

      {editMode && (
        <section className="editor-dock" aria-label="편집 도구">
          <div className="editor-tools">
            <strong>편집 모드</strong><span>변경 내용은 이 브라우저에만 자동 저장됩니다.</span>
            <button type="button" onClick={() => setSettingsOpen((value) => !value)}>문서 설정</button>
            <button type="button" onClick={addSection}>장 추가</button>
            <button type="button" onClick={() => makeBackup()}>JSON 백업</button>
            <button type="button" onClick={() => restoreInputRef.current?.click()}>JSON 복원</button>
            <div className="json-auto-save">
              <span>{jsonAutoSaveStatus}</span>
              {!jsonAutoSaveHandle ? <button type="button" onClick={() => void enableJsonAutoSave()}>JSON 자동 저장 설정</button> : <>
                {(jsonAutoSaveStatus.includes("권한") || jsonAutoSaveStatus.includes("오류")) && <button type="button" onClick={() => void reconnectJsonAutoSave()}>자동 저장 다시 연결</button>}
                <button type="button" onClick={() => void disableJsonAutoSave()}>자동 저장 끄기</button>
              </>}
            </div>
            <button type="button" onClick={runValidation}>배포 전 검수</button>
            <button type="button" className="primary-tool" onClick={() => void exportStatic()}>정적 HTML 내보내기</button>
            <button type="button" className="danger-tool" onClick={() => void resetDraft()}>기본값 복원</button>
            <input ref={restoreInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void restoreBackup(event)} />
          </div>
          {settingsOpen && (
            <div className="settings-panel">
              {([
                ["company", "회사명"], ["headerLabel", "상단 문구"], ["eyebrow", "표지 영문 문구"],
                ["title", "매뉴얼 제목"], ["subtitle", "표지 설명"], ["noticeTitle", "안내문 제목"], ["noticeBody", "안내문 본문"], ["version", "버전"],
                ["lastUpdated", "최종 확인일"], ["verifiedVersion", "확인 제품 버전"], ["nasAddress", "NAS 주소"],
                ["driveWebUrl", "Drive 웹 주소"], ["teamFolder", "Team Folder"], ["localFolder", "내 PC 폴더"],
                ["support", "문의처"], ["networkPolicy", "사내망·VPN 정책"],
              ] as Array<[TextSettingKey, string]>).map(([key, label]) => (
                <label key={key}>{label}<input value={manual.settings[key]} onChange={(event) => setSetting(key, event.target.value)} /></label>
              ))}
              <div className="logo-setting">
                <span>상단 로고</span>
                <img src={manual.settings.brandLogo} alt="현재 상단 로고" />
                <label className="small-button file-button">로고 교체<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void updateBrandLogo(file); event.target.value = ""; }} /></label>
                <button type="button" className="small-button" onClick={() => setSetting("brandLogo", DEFAULT_MANUAL.settings.brandLogo)}>기본 로고</button>
              </div>
              <div className="header-font-setting"><span>상단 문구 글자 크기</span><FontSizeControl value={manual.settings.headerLabelFontSize} fallback={15} onChange={(value) => setSetting("headerLabelFontSize", value)} /></div>
              <label className="font-scale-setting">전체 글자 크기 <strong>{manual.settings.fontScale}%</strong><input type="range" min="80" max="140" step="5" value={manual.settings.fontScale} onChange={(event) => setSetting("fontScale", Number(event.target.value))} /></label>
              <fieldset className="visibility-controls">
                <legend>표시할 화면 요소</legend>
                {([
                  ["showHeaderLabel", "상단 문구"], ["showHero", "표지"], ["showNotice", "안내문"], ["showQuickLinks", "빠른 메뉴"],
                  ["showConnectionCard", "회사 연결 정보"], ["showSources", "공식 참고자료"], ["showFooter", "하단 정보"],
                ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={manual.settings[key]} onChange={(event) => setSetting(key, event.target.checked)} />{label}</label>)}
              </fieldset>
            </div>
          )}
        </section>
      )}

      <div className="layout" id="top">
        <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`} aria-label="매뉴얼 목차">
          <div className="mobile-sidebar-head"><strong>목차</strong><button type="button" onClick={() => setMobileNavOpen(false)}>닫기</button></div>
          <label className="search-label" htmlFor="manual-search">매뉴얼 검색</label>
          <input id="manual-search" type="search" className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 폴더, 비밀번호, 모바일" />
          <p className="result-count" aria-live="polite">{query ? `${visibleSections.length}개 장을 찾았습니다.` : ""}</p>
          <nav>
            {manual.sections.map((section) => editMode ? (
              <div
                className={`toc-drag-item ${draggedSectionId === section.id ? "is-dragging" : ""}`}
                key={section.id}
              >
                <button
                  type="button"
                  className="toc-drag-handle"
                  draggable
                  aria-label={`${section.title} 순서 이동`}
                  onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                    setDraggedSectionId(section.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/manual-section", section.id);
                  }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData("text/manual-section") || draggedSectionId;
                    if (sourceId) reorderSections(sourceId, section.id);
                    setDraggedSectionId(null);
                  }}
                  onDragEnd={() => setDraggedSectionId(null)}
                >⋮⋮</button>
                <a className={activeSectionId === section.id ? "active" : undefined} aria-current={activeSectionId === section.id ? "location" : undefined} href={`#${section.id}`} onClick={() => { activeSectionRef.current = section.id; setActiveSectionId(section.id); setMobileNavOpen(false); }}><span>{section.number}</span>{section.title}</a>
              </div>
            ) : <a className={activeSectionId === section.id ? "active" : undefined} aria-current={activeSectionId === section.id ? "location" : undefined} key={section.id} href={`#${section.id}`} onClick={() => { activeSectionRef.current = section.id; setActiveSectionId(section.id); setMobileNavOpen(false); }}><span>{section.number}</span>{section.title}</a>)}
          </nav>
          {manual.settings.showConnectionCard && <div className="sidebar-note"><strong>회사 연결 정보</strong><span>NAS · {manual.settings.nasAddress}</span><span>Team Folder · {manual.settings.teamFolder}</span><span>웹 · {manual.settings.driveWebUrl}</span><span>문의 · {manual.settings.support}</span></div>}
        </aside>

        <main className="content" id="main">
          {manual.settings.showHero ? <section className="hero">
            {editMode && <button type="button" className="block-hide-button" onClick={() => setSetting("showHero", false)}>표지 숨기기</button>}
            {editMode ? <div className="editable-field hero-eyebrow-editor"><div><span>표지 영문 문구</span><FontSizeControl value={manual.settings.eyebrowFontSize} fallback={15} onChange={(value) => setSetting("eyebrowFontSize", value)} /></div><input className="eyebrow-input" style={manual.settings.eyebrowFontSize ? { fontSize: `${manual.settings.eyebrowFontSize}px` } : undefined} value={manual.settings.eyebrow} onChange={(event) => setSetting("eyebrow", event.target.value)} aria-label="표지 영문 문구" /></div> : <p className="eyebrow" style={manual.settings.eyebrowFontSize ? { fontSize: `${manual.settings.eyebrowFontSize}px` } : undefined}>{manual.settings.eyebrow}</p>}
            {editMode ? <div className="editable-field hero-title-editor"><div><span>매뉴얼 제목</span><FontSizeControl value={manual.settings.heroTitleFontSize} fallback={54} onChange={(value) => setSetting("heroTitleFontSize", value)} /></div><input className="hero-title-input" style={manual.settings.heroTitleFontSize ? { fontSize: `${manual.settings.heroTitleFontSize}px` } : undefined} value={manual.settings.title} onChange={(event) => setSetting("title", event.target.value)} aria-label="매뉴얼 제목" /></div> : <h1 style={manual.settings.heroTitleFontSize ? { fontSize: `${manual.settings.heroTitleFontSize}px` } : undefined}>{manual.settings.title}</h1>}
            {editMode ? <div className="editable-field hero-copy-editor"><div><span>표지 설명</span><FontSizeControl value={manual.settings.heroSubtitleFontSize} fallback={18} onChange={(value) => setSetting("heroSubtitleFontSize", value)} /></div><textarea className="hero-copy-input" style={manual.settings.heroSubtitleFontSize ? { fontSize: `${manual.settings.heroSubtitleFontSize}px` } : undefined} rows={2} value={manual.settings.subtitle} onChange={(event) => setSetting("subtitle", event.target.value)} aria-label="매뉴얼 설명" /></div> : <p className="hero-copy" style={manual.settings.heroSubtitleFontSize ? { fontSize: `${manual.settings.heroSubtitleFontSize}px` } : undefined}>{manual.settings.subtitle}</p>}
            {editMode ? (
              <div className="hero-meta hero-meta-edit">
                <label>버전<input value={manual.settings.version} onChange={(event) => setSetting("version", event.target.value)} /></label>
                <label>최종 확인일<input value={manual.settings.lastUpdated} onChange={(event) => setSetting("lastUpdated", event.target.value)} /></label>
                <label>확인 환경<input value={manual.settings.verifiedVersion} onChange={(event) => setSetting("verifiedVersion", event.target.value)} /></label>
              </div>
            ) : <div className="hero-meta"><span>{manual.settings.version}</span><span>최종 확인 {manual.settings.lastUpdated}</span><span>{manual.settings.verifiedVersion}</span></div>}
          </section> : editMode && <button type="button" className="hidden-block-control" onClick={() => setSetting("showHero", true)}>표지가 숨겨져 있습니다 · 다시 표시</button>}

          {manual.settings.showNotice ? <div className={`notice ${editMode ? "notice-editing" : ""}`} role="note">
            {editMode && <button type="button" className="block-hide-button" onClick={() => setSetting("showNotice", false)}>안내문 숨기기</button>}
            {editMode ? <><div className="editable-field"><div><span>안내문 제목</span><FontSizeControl value={manual.settings.noticeTitleFontSize} fallback={15} onChange={(value) => setSetting("noticeTitleFontSize", value)} /></div><input style={manual.settings.noticeTitleFontSize ? { fontSize: `${manual.settings.noticeTitleFontSize}px` } : undefined} value={manual.settings.noticeTitle} onChange={(event) => setSetting("noticeTitle", event.target.value)} aria-label="안내문 제목" /></div><div className="editable-field"><div><span>안내문 본문</span><FontSizeControl value={manual.settings.noticeBodyFontSize} fallback={15} onChange={(value) => setSetting("noticeBodyFontSize", value)} /></div><textarea style={manual.settings.noticeBodyFontSize ? { fontSize: `${manual.settings.noticeBodyFontSize}px` } : undefined} rows={2} value={manual.settings.noticeBody} onChange={(event) => setSetting("noticeBody", event.target.value)} aria-label="안내문 본문" /></div></> : <><strong style={manual.settings.noticeTitleFontSize ? { fontSize: `${manual.settings.noticeTitleFontSize}px` } : undefined}>{manual.settings.noticeTitle}</strong><span style={manual.settings.noticeBodyFontSize ? { fontSize: `${manual.settings.noticeBodyFontSize}px` } : undefined}>{manual.settings.noticeBody}</span></>}
          </div> : editMode && <button type="button" className="hidden-block-control" onClick={() => setSetting("showNotice", true)}>안내문이 숨겨져 있습니다 · 다시 표시</button>}

          {manual.settings.showQuickLinks ? <section className="quick-grid" aria-label="주요 작업 바로가기">
            {editMode && <button type="button" className="block-hide-button quick-hide-button" onClick={() => setSetting("showQuickLinks", false)}>빠른 메뉴 숨기기</button>}
            {manual.quickLinks.map((item, index) => editMode ? (
              <div
                className={`quick-card quick-card-editor ${draggedQuickIndex === index ? "is-dragging" : ""}`}
                key={`${item.sectionId}-${index}`}
              >
                <button
                  type="button"
                  className="quick-drag-handle"
                  draggable
                  aria-label={`${item.label} 순서 이동`}
                  onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                    setDraggedQuickIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/manual-quick-index", String(index));
                  }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const rawSource = event.dataTransfer.getData("text/manual-quick-index");
                    const sourceIndex = rawSource !== "" ? Number(rawSource) : draggedQuickIndex;
                    if (sourceIndex !== null) reorderQuickLinks(sourceIndex, index);
                    setDraggedQuickIndex(null);
                  }}
                  onDragEnd={() => setDraggedQuickIndex(null)}
                >⋮⋮</button>
                <label>기호<input value={item.icon} onChange={(event) => updateQuickLink(index, { icon: event.target.value })} /></label>
                <div className="editable-field quick-label-field"><div><span>메뉴명</span><FontSizeControl value={item.labelFontSize} fallback={15} onChange={(value) => updateQuickLink(index, { labelFontSize: value })} /></div><input style={item.labelFontSize ? { fontSize: `${item.labelFontSize}px` } : undefined} value={item.label} onChange={(event) => updateQuickLink(index, { label: event.target.value })} /></div>
                <div className="editable-field quick-hint-field"><div><span>보조 문구</span><FontSizeControl value={item.hintFontSize} fallback={15} onChange={(value) => updateQuickLink(index, { hintFontSize: value })} /></div><input style={item.hintFontSize ? { fontSize: `${item.hintFontSize}px` } : undefined} value={item.hint} onChange={(event) => updateQuickLink(index, { hint: event.target.value })} /></div>
                <select value={item.sectionId} onChange={(event) => updateQuickLink(index, { sectionId: event.target.value })} aria-label={`${item.label} 연결 장`}>
                  {manual.sections.map((section) => <option value={section.id} key={section.id}>{section.number}. {section.title}</option>)}
                </select>
                <div className="quick-order-actions"><button type="button" onClick={() => moveQuickLink(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveQuickLink(index, 1)} disabled={index === manual.quickLinks.length - 1}>↓</button><button type="button" className="danger-button" onClick={() => removeQuickLink(index)} aria-label={`${item.label} 삭제`}>×</button></div>
              </div>
            ) : <a className="quick-card" href={`#${item.sectionId}`} key={`${item.sectionId}-${index}`}><span>{item.icon}</span><strong style={item.labelFontSize ? { fontSize: `${item.labelFontSize}px` } : undefined}>{item.label}</strong><small style={item.hintFontSize ? { fontSize: `${item.hintFontSize}px` } : undefined}>{item.hint}</small></a>)}
            {editMode && <button type="button" className="add-quick-button" onClick={addQuickLink}>+ 빠른 메뉴 추가</button>}
          </section> : editMode && <button type="button" className="hidden-block-control" onClick={() => setSetting("showQuickLinks", true)}>빠른 메뉴가 숨겨져 있습니다 · 다시 표시</button>}

          {visibleSections.length === 0 ? <p className="empty-result">검색 결과가 없습니다. 다른 단어로 찾아보세요.</p> : (
            <div className="section-list" aria-live="polite">
              {visibleSections.map((section, sectionIndex) => (
                <section className={`manual-section ${visibleSectionIds.has(section.id) ? "is-visible" : ""}`} id={section.id} key={section.id}>
                  {editMode && (
                    <div className="section-controls">
                      <span>장 편집</span>
                      <button type="button" onClick={() => moveSection(section.id, -1)} disabled={sectionIndex === 0}>위로</button>
                      <button type="button" onClick={() => moveSection(section.id, 1)} disabled={sectionIndex === visibleSections.length - 1}>아래로</button>
                      <button type="button" className="danger-button" onClick={() => removeSection(section.id)}>장 삭제</button>
                    </div>
                  )}
                  <header className="section-heading">
                    <span className="section-number">{section.number}</span>
                    <div>
                      {editMode ? (
                        <div className="section-edit-fields">
                          <input value={section.eyebrow} onChange={(event) => updateSection(section.id, { eyebrow: event.target.value })} aria-label="장 분류" />
                          <div className="editable-field"><div><span>장 제목</span><FontSizeControl value={section.titleFontSize} fallback={34} onChange={(value) => updateSection(section.id, { titleFontSize: value })} /></div><input className="section-title-input" style={section.titleFontSize ? { fontSize: `${section.titleFontSize}px` } : undefined} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} aria-label="장 제목" /></div>
                          <div className="editable-field"><div><span>장 설명</span><FontSizeControl value={section.summaryFontSize} fallback={15} onChange={(value) => updateSection(section.id, { summaryFontSize: value })} /></div><textarea rows={2} style={section.summaryFontSize ? { fontSize: `${section.summaryFontSize}px` } : undefined} value={section.summary} onChange={(event) => updateSection(section.id, { summary: event.target.value })} aria-label="장 설명" /></div>
                        </div>
                      ) : <><p className="section-eyebrow">{section.eyebrow}</p><h2 style={section.titleFontSize ? { fontSize: `${section.titleFontSize}px` } : undefined}>{section.title}</h2><p style={section.summaryFontSize ? { fontSize: `${section.summaryFontSize}px` } : undefined}>{section.summary}</p></>}
                    </div>
                  </header>
                  <div className="section-meta">
                    {editMode ? (
                      <>
                        <label>대상<input value={section.audience} onChange={(event) => updateSection(section.id, { audience: event.target.value })} /></label>
                        <label>환경<input value={section.platforms.join(", ")} onChange={(event) => updateSection(section.id, { platforms: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                        <label>예상 시간<input value={section.duration} onChange={(event) => updateSection(section.id, { duration: event.target.value })} /></label>
                      </>
                    ) : <><strong>{section.audience}</strong>{section.platforms.map((platform) => <span key={platform}>{platform}</span>)}<span>{section.duration}</span></>}
                  </div>

                  <div className="steps">
                    {section.steps.map((step, stepIndex) => (
                      <article className={`step-card ${draggedStep?.stepId === step.id ? "is-dragging" : ""}`} key={step.id}>
                        {editMode && (
                          <div className="step-controls">
                            <button
                              type="button"
                              className="step-drag-handle"
                              draggable
                              aria-label={`${step.title} 순서 이동`}
                              onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                                setDraggedStep({ sectionId: section.id, stepId: step.id });
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/manual-step", step.id);
                              }}
                              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const sourceId = event.dataTransfer.getData("text/manual-step") || draggedStep?.stepId;
                                if (sourceId && (!draggedStep || draggedStep.sectionId === section.id)) reorderSteps(section.id, sourceId, step.id);
                                setDraggedStep(null);
                              }}
                              onDragEnd={() => setDraggedStep(null)}
                            >⋮⋮</button>
                            <span>단계 {stepIndex + 1}</span>
                            <button type="button" onClick={() => moveStep(section.id, step.id, -1)} disabled={stepIndex === 0}>위로</button>
                            <button type="button" onClick={() => moveStep(section.id, step.id, 1)} disabled={stepIndex === section.steps.length - 1}>아래로</button>
                            <button type="button" className="danger-button" onClick={() => removeStep(section.id, step.id)}>삭제</button>
                          </div>
                        )}
                        <div className="step-heading"><span>{stepIndex + 1}</span><div>
                          {editMode ? <div className="step-text-editor">
                            <div className="editable-field"><div><span>단계 제목</span><FontSizeControl value={step.titleFontSize} fallback={21} onChange={(value) => updateStep(section.id, step.id, { titleFontSize: value })} /></div><input className="step-title-input" style={step.titleFontSize ? { fontSize: `${step.titleFontSize}px` } : undefined} value={step.title} onChange={(event) => updateStep(section.id, step.id, { title: event.target.value })} aria-label="단계 제목" /></div>
                            <div className="editable-field"><div><span>단계 설명</span><FontSizeControl value={step.bodyFontSize} fallback={15} onChange={(value) => updateStep(section.id, step.id, { bodyFontSize: value })} /></div><textarea rows={3} style={step.bodyFontSize ? { fontSize: `${step.bodyFontSize}px` } : undefined} value={step.body} onChange={(event) => updateStep(section.id, step.id, { body: event.target.value })} aria-label="단계 설명" /></div>
                          </div> : <><h3 style={step.titleFontSize ? { fontSize: `${step.titleFontSize}px` } : undefined}>{step.title}</h3><p style={step.bodyFontSize ? { fontSize: `${step.bodyFontSize}px` } : undefined}>{step.body}</p></>}
                        </div></div>
                        {step.media ? <MediaBlock
                          media={step.media}
                          asset={step.media.assetId ? assets[step.media.assetId] : undefined}
                          editMode={editMode}
                          onChange={(patch) => updateMedia(section.id, step, patch)}
                          onUpload={(file) => void uploadMedia(section.id, step, file)}
                          onRemove={() => void removeMedia(section.id, step)}
                          onDeleteSlot={() => void deleteMediaSlot(section.id, step)}
                          onAnnotate={() => setAnnotationTarget({ sectionId: section.id, stepId: step.id })}
                          onZoom={() => {
                            const uploaded = step.media?.assetId ? assets[step.media.assetId] : undefined;
                            const src = uploaded?.dataUrl || step.media?.src;
                            if (src) setZoomedAsset({ id: "preview", name: step.media?.alt || "매뉴얼 화면", type: "image/png", dataUrl: src, size: 0, updatedAt: "" });
                          }}
                        /> : editMode && <button type="button" className="add-media-button" onClick={() => updateStep(section.id, step.id, { media: createEmptyMedia() })}>+ 사진 영역 추가</button>}
                        {editMode ? (
                          <div className="bullets-editor"><div><span>확인 항목 · 한 줄에 하나</span><FontSizeControl value={step.bulletFontSize} fallback={15} onChange={(value) => updateStep(section.id, step.id, { bulletFontSize: value })} /></div><textarea rows={Math.max(3, step.bullets.length + 1)} style={step.bulletFontSize ? { fontSize: `${step.bulletFontSize}px` } : undefined} value={step.bullets.join("\n")} onChange={(event) => updateStep(section.id, step.id, { bullets: event.target.value.split("\n") })} /></div>
                        ) : <ul className="bullet-list" style={step.bulletFontSize ? { fontSize: `${step.bulletFontSize}px` } : undefined}>{step.bullets.filter(Boolean).map((bullet, index) => <li key={`${step.id}-${index}`}>{bullet}</li>)}</ul>}
                        {step.callout ? (
                          <aside className={`callout ${step.callout.tone} ${editMode ? "callout-editor" : ""}`}>
                            {editMode ? <div className="callout-editor-grid">
                              <label>종류<select value={step.callout.tone} onChange={(event) => updateStep(section.id, step.id, { callout: { ...step.callout!, tone: event.target.value as typeof step.callout.tone } })}><option value="info">안내</option><option value="tip">팁</option><option value="warning">주의</option><option value="danger">위험</option></select></label>
                              <div className="editable-field"><div><span>제목</span><FontSizeControl value={step.callout.titleFontSize} fallback={15} onChange={(value) => updateStep(section.id, step.id, { callout: { ...step.callout!, titleFontSize: value } })} /></div><input style={step.callout.titleFontSize ? { fontSize: `${step.callout.titleFontSize}px` } : undefined} value={step.callout.title} onChange={(event) => updateStep(section.id, step.id, { callout: { ...step.callout!, title: event.target.value } })} /></div>
                              <div className="editable-field callout-text-field"><div><span>내용</span><FontSizeControl value={step.callout.textFontSize} fallback={15} onChange={(value) => updateStep(section.id, step.id, { callout: { ...step.callout!, textFontSize: value } })} /></div><textarea rows={3} style={step.callout.textFontSize ? { fontSize: `${step.callout.textFontSize}px` } : undefined} value={step.callout.text} onChange={(event) => updateStep(section.id, step.id, { callout: { ...step.callout!, text: event.target.value } })} /></div>
                              <button type="button" className="small-button danger-button callout-delete" onClick={() => updateStep(section.id, step.id, { callout: undefined })}>주의·참고 박스 삭제</button>
                            </div> : <><span className="callout-label">{CALLOUT_LABELS[step.callout.tone] || "참고"}</span><div><strong style={step.callout.titleFontSize ? { fontSize: `${step.callout.titleFontSize}px` } : undefined}>{step.callout.title}</strong><p style={step.callout.textFontSize ? { fontSize: `${step.callout.textFontSize}px` } : undefined}>{step.callout.text}</p></div></>}
                          </aside>
                        ) : editMode && <button type="button" className="add-callout-button" onClick={() => updateStep(section.id, step.id, { callout: { tone: "info", title: "참고 제목", text: "참고 내용을 입력하세요." } })}>+ 주의·참고 박스 추가</button>}
                      </article>
                    ))}
                  </div>
                  {editMode && <button type="button" className="add-step-button" onClick={() => addStep(section.id)}>+ 단계 추가</button>}
                  {editMode ? <div className="sources-editor">
                    <header><strong>공식 참고자료</strong><span>{manual.settings.showSources ? "배포본에 표시됨" : "현재 숨김"}</span><button type="button" onClick={() => addSource(section.id)}>+ 참고자료 추가</button></header>
                    {(section.sources || []).map((source, sourceIndex) => <div className="source-edit-row" key={`${source.url}-${sourceIndex}`}><input value={source.label} onChange={(event) => updateSource(section.id, sourceIndex, { label: event.target.value })} aria-label="참고자료 이름" /><input value={source.url} onChange={(event) => updateSource(section.id, sourceIndex, { url: event.target.value })} aria-label="참고자료 주소" /><button type="button" className="danger-button" onClick={() => removeSource(section.id, sourceIndex)}>삭제</button></div>)}
                  </div> : manual.settings.showSources && section.sources && section.sources.length > 0 && <details className="sources"><summary>공식 참고 자료</summary><div>{section.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label}</a>)}</div></details>}
                </section>
              ))}
            </div>
          )}
          {manual.settings.showFooter && <footer className="footer"><strong>{manual.settings.company}</strong><span>{manual.settings.title} · {manual.settings.version}</span><span>문의 {manual.settings.support}</span></footer>}
        </main>
      </div>

      {annotationTarget && annotationStep && annotationSrc && <AnnotationEditor src={annotationSrc} baseSrc={annotationBaseSrc} alt={annotationStep.media?.alt || "매뉴얼 사진"} onCancel={() => setAnnotationTarget(null)} onSave={(dataUrl) => void saveAnnotation(dataUrl)} />}

      {issues && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIssues(null)}>
          <section className="validation-modal" role="dialog" aria-modal="true" aria-labelledby="validation-title">
            <header><div><p>배포 전 검수</p><h2 id="validation-title">{issues.length ? `${issues.length}개 확인 항목` : "모든 항목을 확인했습니다"}</h2></div><button type="button" onClick={() => setIssues(null)} aria-label="닫기">×</button></header>
            {issues.length ? <ul>{issues.map((issue, index) => <li className={issue.level} key={`${issue.message}-${index}`}><strong>{issue.level === "error" ? "오류" : "확인"}</strong><div><span>{issue.message}</span>{issue.target && <small>{issue.target}</small>}</div></li>)}</ul> : <p className="validation-ok">필수 회사 값, 미디어 참조, 대체 텍스트, 중복 ID를 모두 확인했습니다.</p>}
            <footer><button type="button" onClick={() => setIssues(null)}>닫기</button>{issues.every((issue) => issue.level !== "error") && <button type="button" className="modal-primary" onClick={() => { setIssues(null); void exportStatic(); }}>그래도 정적 HTML 만들기</button>}</footer>
          </section>
        </div>
      )}

      {zoomedAsset && (
        <div className="lightbox open" role="dialog" aria-modal="true" aria-label="이미지 크게 보기">
          <button type="button" onClick={() => setZoomedAsset(null)} aria-label="닫기">×</button>
          <img src={zoomedAsset.dataUrl} alt={zoomedAsset.name} />
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
