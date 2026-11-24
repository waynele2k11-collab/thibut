"use client";

// Keepsake editor (docs/KEEPSAKE_EDITOR_PLAN.md). A production tool for the admin: typed text in
// real fonts, the customer's photo and artwork, placed on up to three film layers, exported as one
// transparent PNG per film plus a preview. Everything happens in this browser tab. The photo is
// read from the file input, kept in memory and never sent anywhere.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { blocksExport, describeIssues, sceneIssues, warningKey, warningsOf } from "@/lib/keepsake-editor/issues";
import { initialEditorState, reduceEditor } from "@/lib/keepsake-editor/reducer";
import {
  LAYER_IDS,
  LAYER_LABELS,
  MAX_PROJECT_FILE_CHARS,
  PROJECT_FILE_ERROR,
  emptyScene,
  parseProjectFile,
  type LayerId,
} from "@/lib/keepsake-editor/scene";
import { DEFAULT_MARGIN_MM, KEEPSAKE_SIZES } from "@/lib/keepsake-editor/sizes";
import { resolveSheet, type SheetSpec } from "@/lib/keepsake-editor/units";
import { BlockPanel } from "./BlockPanel";
import { ExportPanel } from "./ExportPanel";
import { PreviewCanvas } from "./PreviewCanvas";
import { SizePanel } from "./SizePanel";
import {
  CONCEPT_PREVIEW_BAND,
  imageSizes,
  makeMeasure,
  type Backdrop,
  type DrawAssets,
  type LoadedImage,
} from "./draw";
import {
  ExportError,
  assertFontsReady,
  downloadBlob,
  exportLayerPng,
  exportPreviewPng,
  nonEmptyLayers,
  projectBlob,
  sceneFingerprint,
  startFilmJob,
  type FilmJob,
} from "./export";
import { CheckField, HELP, PANEL, SelectField } from "./fields";
import { editorFontFamily, useEditorFonts, type EditorFont } from "./use-fonts";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIDE_PX = 12000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Both presets start in Great Vibes (SIL Open Font License). UTM Thư Pháp Thiên Ân stays in the
// list, with a note on its licence basis, for the admin to choose on purpose.
const HERO_FONT_ID = "great-vibes";
const VERSE_FONT_ID = "great-vibes";
/** A pause between files, so the browser treats them as separate downloads. */
const DOWNLOAD_GAP_MS = 400;

const BACKDROP_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "checked", label: "Checked (shows what is clear)" },
] as const;

function newId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function readImage(file: File): Promise<LoadedImage> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new ExportError("Use a JPEG, PNG or WebP image. TIFF and HEIC files cannot be read reliably by browsers.");
  }
  if (file.size > MAX_IMAGE_BYTES) throw new ExportError("That image is larger than 25 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ExportError("That image could not be read.");
  }
  if (Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_SIDE_PX) {
    bitmap.close();
    throw new ExportError("That image is larger than 12,000 pixels on its longer side.");
  }
  return { bitmap, w: bitmap.width, h: bitmap.height };
}

export function KeepsakeEditor({ fonts }: { fonts: EditorFont[] }) {
  const [state, dispatch] = useReducer(
    reduceEditor,
    undefined,
    () => initialEditorState(emptyScene(KEEPSAKE_SIZES[0].wMm, KEEPSAKE_SIZES[0].hMm, DEFAULT_MARGIN_MM))
  );
  const scene = state.scene;
  const [images, setImages] = useState<ReadonlyMap<string, LoadedImage>>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop>("light");
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ back: true, middle: true, front: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fontStatus = useEditorFonts(fonts);
  /** The warnings the admin accepted with "Download anyway"; a different set needs a new tick. */
  const [acceptedKey, setAcceptedKey] = useState<string | null>(null);
  /** The last download's job code and the state of the project it belongs to. */
  const [lastJob, setLastJob] = useState<{ hash: string; code: string } | null>(null);
  const imagesRef = useRef(images);
  const closedRef = useRef(new WeakSet<ImageBitmap>());

  // An image is live while its block is in the scene or in the one step of undo. A removed photo
  // is kept only while "Undo last change" could bring it back; after that it is dropped here and
  // its pixels are freed below.
  const keepKey = useMemo(() => {
    const ids = new Set<string>();
    for (const block of scene.blocks) ids.add(block.id);
    for (const block of state.previous?.blocks ?? []) ids.add(block.id);
    return Array.from(ids).sort().join(",");
  }, [scene.blocks, state.previous]);
  const liveImages = useMemo<ReadonlyMap<string, LoadedImage>>(() => {
    const keep = new Set(keepKey.split(","));
    return new Map(Array.from(images).filter(([id]) => keep.has(id)));
  }, [images, keepKey]);

  const assets = useMemo<DrawAssets>(() => ({ images: liveImages, fontFamily: editorFontFamily }), [liveImages]);
  const sizes = useMemo(() => imageSizes(assets), [assets]);
  // A canvas that is never shown: it measures text with the same fonts the films are drawn in.
  const measureCtx = useMemo(() => document.createElement("canvas").getContext("2d"), []);
  const measure = useMemo(() => (measureCtx ? makeMeasure(measureCtx, assets) : null), [measureCtx, assets]);
  const sheet = useMemo<SheetSpec | null>(() => {
    try {
      return resolveSheet(scene.pieceWmm, scene.pieceHmm, scene.marginMm, scene.cropBorder);
    } catch {
      return null;
    }
  }, [scene.pieceWmm, scene.pieceHmm, scene.marginMm, scene.cropBorder]);
  const issues = useMemo(
    () => sceneIssues(scene, fonts, fontStatus, sizes, sheet && measure ? { sheet, measure } : null),
    [scene, fonts, fontStatus, sizes, sheet, measure]
  );
  const described = useMemo(() => describeIssues(scene, issues), [scene, issues]);
  const warnKey = useMemo(() => warningKey(issues), [issues]);
  const accepted = warnKey === "" || acceptedKey === warnKey;
  const fingerprint = useMemo(() => sceneFingerprint(scene, assets), [scene, assets]);
  const layers = useMemo(() => nonEmptyLayers(scene), [scene]);
  const attachedIds = useMemo(() => new Set(liveImages.keys()), [liveImages]);
  const redrawKey = useMemo(() => JSON.stringify(fontStatus), [fontStatus]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Free the pixels of images that can no longer come back.
  useEffect(() => {
    for (const [id, image] of images) {
      if (liveImages.has(id) || closedRef.current.has(image.bitmap)) continue;
      image.bitmap.close();
      closedRef.current.add(image.bitmap);
    }
  }, [images, liveImages]);

  // Leaving the page frees every image.
  useEffect(
    () => () => {
      for (const image of imagesRef.current.values()) image.bitmap.close();
    },
    []
  );

  const fail = (error: unknown, fallback: string) =>
    setMessage({ kind: "error", text: error instanceof ExportError ? error.message : fallback });

  const addText = (preset: "hero" | "verse") => {
    const preferred = preset === "hero" ? HERO_FONT_ID : VERSE_FONT_ID;
    const font = fonts.find((f) => f.id === preferred) ?? fonts[0];
    if (!font) return;
    const id = newId("t");
    dispatch({ type: "addText", id, preset, fontId: font.id });
    setSelectedId(id);
    setMessage(null);
  };

  const addImage = async (file: File, isCustomerPhoto: boolean) => {
    try {
      const image = await readImage(file);
      const id = newId("i");
      setImages((prev) => new Map(prev).set(id, image));
      dispatch({ type: "addImage", id, fileName: file.name, aspect: image.h / image.w, isCustomerPhoto });
      setSelectedId(id);
      setMessage(null);
    } catch (error) {
      fail(error, "That image could not be added.");
    }
  };

  const attachImage = async (blockId: string, file: File) => {
    try {
      const image = await readImage(file);
      const replaced = liveImages.get(blockId);
      setImages((prev) => new Map(prev).set(blockId, image));
      dispatch({ type: "update", id: blockId, patch: { fileName: file.name } });
      setMessage(null);
      // The file it replaces is not drawn again: free its pixels.
      if (replaced && replaced.bitmap !== image.bitmap) replaced.bitmap.close();
    } catch (error) {
      fail(error, "That image could not be attached.");
    }
  };

  const fillFilm = (blockId: string) => {
    const image = liveImages.get(blockId);
    if (!image) return;
    dispatch({ type: "fillFilm", id: blockId, sourceAspect: image.h / image.w });
  };

  /**
   * One job for the project as it is now. While the project does not change, every download gets
   * the same job code, so films downloaded one at a time still show that they belong together.
   */
  const jobForNow = (): FilmJob => {
    const fresh = startFilmJob(scene, assets, new Date().toISOString());
    if (lastJob && lastJob.hash === fresh.hash) return { ...fresh, code: lastJob.code };
    return fresh;
  };

  /** `work` gets one snapshot of the project; every file it makes comes from that snapshot. */
  const runExport = async (
    work: (job: FilmJob, sheetSpec: SheetSpec) => Promise<string[]>,
    done: (files: string[], job: FilmJob) => string
  ) => {
    if (!sheet || busy || blocksExport(issues) || !accepted) return;
    const job = jobForNow();
    const warned = warningsOf(issues).length;
    setBusy(true);
    setMessage(null);
    try {
      await assertFontsReady(job.scene, assets, (fontId) => fontStatus[fontId] === "ready");
      const files = await work(job, sheet);
      setLastJob({ hash: job.hash, code: job.code });
      const tail = warned > 0 ? ` ${warned} warning${warned === 1 ? " was" : "s were"} accepted.` : "";
      setMessage({ kind: "ok", text: `${done(files, job)} Job code ${job.code}.${tail}` });
    } catch (error) {
      fail(error, "The file could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const downloadLayer = (layer: LayerId) => {
    void runExport(
      async (job, sheetSpec) => {
        const { blob, fileName } = await exportLayerPng(job, layer, sheetSpec, assets);
        downloadBlob(blob, fileName);
        return [fileName];
      },
      (files) => `Downloaded the ${LAYER_LABELS[layer]} film: ${files[0]}.`
    );
  };

  const downloadPreview = () => {
    void runExport(
      async (job, sheetSpec) => {
        const { blob, fileName } = await exportPreviewPng(job, sheetSpec, assets, backdrop);
        downloadBlob(blob, fileName);
        return [fileName];
      },
      (files) => `Downloaded the preview: ${files[0]}.`
    );
  };

  const downloadAll = () => {
    void runExport(
      async (job, sheetSpec) => {
        const files: string[] = [];
        for (const layer of job.layers) {
          const { blob, fileName } = await exportLayerPng(job, layer, sheetSpec, assets);
          downloadBlob(blob, fileName);
          files.push(fileName);
          await new Promise((resolve) => window.setTimeout(resolve, DOWNLOAD_GAP_MS));
        }
        const preview = await exportPreviewPng(job, sheetSpec, assets, backdrop);
        downloadBlob(preview.blob, preview.fileName);
        files.push(preview.fileName);
        return files;
      },
      (files, job) =>
        `Downloaded ${job.layers.length} film${job.layers.length === 1 ? "" : "s"} and the preview (${files.length} files).`
    );
  };

  const saveProject = () => {
    const { blob, fileName } = projectBlob(scene);
    downloadBlob(blob, fileName);
    setMessage({ kind: "ok", text: `Saved the project file: ${fileName}. Images are not included.` });
  };

  const openProject = async (file: File) => {
    try {
      if (file.size > MAX_PROJECT_FILE_CHARS * 4) throw new Error(PROJECT_FILE_ERROR);
      const loaded = parseProjectFile(await file.text());
      const old = Array.from(images.values());
      dispatch({ type: "load", scene: loaded });
      setImages(new Map());
      setSelectedId(null);
      setAcceptedKey(null);
      setLastJob(null);
      // The opened project starts without images: free the ones that were attached.
      for (const image of old) image.bitmap.close();
      const count = loaded.blocks.filter((b) => b.kind === "image").length;
      setMessage({
        kind: "ok",
        text: count > 0 ? `Project opened. Attach its ${count} image file${count === 1 ? "" : "s"} again.` : "Project opened.",
      });
    } catch {
      setMessage({ kind: "error", text: PROJECT_FILE_ERROR });
    }
  };

  if (fonts.length === 0) {
    return (
      <p role="alert" className="rounded border border-error bg-error-container px-4 py-3 text-on-error-container">
        No font is available. A font is offered only when its file is in assets/fonts, the catalogue marks it
        approved for commercial print, and it has every Vietnamese letter.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="min-h-6">
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`rounded border px-4 py-3 font-body-md text-body-md ${
              message.kind === "error"
                ? "border-error bg-error-container text-on-error-container"
                : "border-primary bg-surface-container-lowest text-on-background"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      <p className={`${HELP} lg:hidden`}>
        This editor is made for a laptop screen. On a narrow screen the panels stack under the preview.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <section aria-labelledby="ke-preview-title" className={PANEL}>
            <h2 id="ke-preview-title" className="font-headline-sm text-headline-sm text-on-background">
              Preview
            </h2>
            {sheet ? (
              <PreviewCanvas
                scene={scene}
                sheet={sheet}
                assets={assets}
                selectedId={selectedId}
                backdrop={backdrop}
                visible={visible}
                redrawKey={redrawKey}
                onSelect={setSelectedId}
                onMove={(id, xMm, yMm) =>
                  dispatch({ type: "update", id, patch: { xMm, yMm }, coalesceKey: `${id}:drag` })
                }
                onMoveEnd={() => dispatch({ type: "endRun" })}
              />
            ) : (
              <p role="alert" className="text-error">
                This size and margin leave no room for a film. Change the size or the margin.
              </p>
            )}
            <p className={HELP}>
              {CONCEPT_PREVIEW_BAND} The dashed line is the film edge; the space outside it is the margin
              between film and piece. The dotted line inside it is the safe zone: keep text and faces
              inside it. Neither line is printed.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField label="Backdrop" value={backdrop} options={BACKDROP_OPTIONS} onChange={setBackdrop} />
              <fieldset className="space-y-1">
                <legend className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-1.5">
                  Layers shown
                </legend>
                {LAYER_IDS.map((layer) => (
                  <CheckField
                    key={layer}
                    label={LAYER_LABELS[layer]}
                    checked={visible[layer]}
                    onChange={(checked) => setVisible((prev) => ({ ...prev, [layer]: checked }))}
                  />
                ))}
              </fieldset>
            </div>
          </section>
        </div>
        {/* Leaving a field ends its run of edits, so the next edit is its own undo step. */}
        <div className="space-y-4" onBlur={() => dispatch({ type: "endRun" })}>
          <SizePanel scene={scene} sheet={sheet} dispatch={dispatch} />
          <BlockPanel
            scene={scene}
            selectedId={selectedId}
            fonts={fonts}
            fontStatus={fontStatus}
            attachedIds={attachedIds}
            issues={issues}
            dispatch={dispatch}
            onSelect={setSelectedId}
            onAddText={addText}
            onAddImage={(file, isCustomerPhoto) => void addImage(file, isCustomerPhoto)}
            onAttach={(blockId, file) => void attachImage(blockId, file)}
            onFillFilm={fillFilm}
          />
          <ExportPanel
            scene={scene}
            sheet={sheet}
            layers={layers}
            described={described}
            accepted={accepted}
            jobCode={lastJob && lastJob.hash === fingerprint ? lastJob.code : null}
            busy={busy}
            canUndo={state.previous !== null}
            dispatch={dispatch}
            onAccept={(tick) => setAcceptedKey(tick ? warnKey : null)}
            onDownloadAll={downloadAll}
            onDownloadLayer={downloadLayer}
            onDownloadPreview={downloadPreview}
            onSaveProject={saveProject}
            onOpenProject={(file) => void openProject(file)}
          />
        </div>
      </div>
    </div>
  );
}
