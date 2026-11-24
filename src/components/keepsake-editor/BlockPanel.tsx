"use client";

import { useId, useState } from "react";
import { ADMIN_FIELD, ADMIN_LABEL } from "@/components/admin/AdminNotice";
import type { Issue } from "@/lib/keepsake-editor/issues";
import { IMAGE_FILM_REMINDER } from "@/lib/keepsake-editor/issues";
import type { Action } from "@/lib/keepsake-editor/reducer";
import {
  LAYER_IDS,
  LAYER_LABELS,
  MAX_IMAGE_BLOCKS,
  MAX_IMAGE_WIDTH_MM,
  MAX_TEXT_BLOCKS,
  MAX_TEXT_CHARS,
  MAX_TEXT_SIZE_MM,
  MIN_IMAGE_WIDTH_MM,
  MIN_TEXT_SIZE_MM,
  POSITION_LIMIT_MM,
  hiddenCharCount,
  type Block,
  type ImageBlock,
  type LayerId,
  type Scene,
  type TextBlock,
} from "@/lib/keepsake-editor/scene";
import { CheckField, HELP, NumberField, PANEL, PANEL_TITLE, SMALL_BUTTON, SelectField } from "./fields";
import type { EditorFont, FontStatus } from "./use-fonts";

const LAYER_OPTIONS = LAYER_IDS.map((id) => ({ value: id, label: LAYER_LABELS[id] }));
const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
] as const;

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function blockTitle(block: Block): string {
  if (block.kind === "image") return `${block.isCustomerPhoto ? "Customer photo" : "Image"}: ${block.fileName}`;
  const firstLine = block.text.split("\n")[0] ?? "";
  return `Text: ${firstLine.slice(0, 28) || "(empty)"}`;
}

function IssueList({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li
          key={`${issue.level}:${issue.message}`}
          role={issue.level === "block" ? "alert" : "status"}
          className={`rounded border px-3 py-2 text-sm ${
            issue.level === "block"
              ? "border-error bg-error-container text-on-error-container"
              : "border-outline-variant bg-surface-container text-on-surface"
          }`}
        >
          {issue.level === "block" ? "Stops export: " : issue.level === "warn" ? "Check: " : "Note: "}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function TextControls({
  block,
  fonts,
  fontStatus,
  dispatch,
}: {
  block: TextBlock;
  fonts: readonly EditorFont[];
  fontStatus: Readonly<Record<string, FontStatus>>;
  dispatch: (action: Action) => void;
}) {
  const textId = useId();
  const colorId = useId();
  // Stays up until another block is selected (the panel is keyed by block id).
  const [hiddenRemoved, setHiddenRemoved] = useState(false);
  const fontNote = fonts.find((font) => font.id === block.fontId)?.note;
  const update = (patch: Partial<TextBlock>, key?: string) =>
    dispatch({ type: "update", id: block.id, patch, coalesceKey: key ? `${block.id}:${key}` : undefined });
  const fontOptions = fonts.map((font) => ({
    value: font.id,
    label: `${font.name}${fontStatus[font.id] === "ready" ? "" : fontStatus[font.id] === "error" ? " (failed to load)" : " (loading)"}`,
  }));
  if (!fonts.some((font) => font.id === block.fontId)) {
    fontOptions.unshift({ value: block.fontId, label: `${block.fontId} (not available)` });
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={textId} className={ADMIN_LABEL}>
          Text
        </label>
        <textarea
          id={textId}
          value={block.text}
          rows={Math.min(8, Math.max(2, block.text.split("\n").length + 1))}
          maxLength={MAX_TEXT_CHARS}
          lang="vi"
          spellCheck={false}
          onChange={(event) => {
            if (hiddenCharCount(event.target.value) > 0) setHiddenRemoved(true);
            update({ text: event.target.value }, "text");
          }}
          className={`${ADMIN_FIELD} h-auto py-2`}
        />
        <p className={HELP}>
          Typed text only. Each line prints exactly as typed: press Enter where a line should break.
          Lines never wrap by themselves.
        </p>
        {hiddenRemoved && (
          <p role="status" className={HELP}>
            Hidden characters removed. Pasted text carried characters that print nothing (zero-width or
            direction marks); they were taken out.
          </p>
        )}
      </div>
      <SelectField label="Font" value={block.fontId} options={fontOptions} onChange={(fontId) => update({ fontId })} />
      {fontNote && <p className={HELP}>{fontNote}</p>}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Letter size"
          suffix="mm"
          value={block.sizeMm}
          min={MIN_TEXT_SIZE_MM}
          max={MAX_TEXT_SIZE_MM}
          step={0.5}
          onCommit={(sizeMm) => update({ sizeMm }, "size")}
        />
        <NumberField
          label="Line spacing"
          value={block.lineHeight}
          min={0.6}
          max={3}
          step={0.05}
          onCommit={(lineHeight) => update({ lineHeight }, "lineHeight")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={colorId} className={ADMIN_LABEL}>
            Colour
          </label>
          <input
            id={colorId}
            type="color"
            value={block.colorHex}
            onChange={(event) => update({ colorHex: event.target.value }, "color")}
            className="h-11 w-full rounded border border-outline-variant bg-surface-container-lowest p-1"
          />
        </div>
        <SelectField
          label="Alignment"
          value={block.align}
          options={ALIGN_OPTIONS}
          onChange={(align) => update({ align })}
        />
      </div>
    </div>
  );
}

function ImageControls({
  block,
  attached,
  dispatch,
  onAttach,
  onFillFilm,
}: {
  block: ImageBlock;
  attached: boolean;
  dispatch: (action: Action) => void;
  onAttach: (blockId: string, file: File) => void;
  onFillFilm: (blockId: string) => void;
}) {
  const attachId = useId();
  const update = (patch: Partial<ImageBlock>, key?: string) =>
    dispatch({ type: "update", id: block.id, patch, coalesceKey: key ? `${block.id}:${key}` : undefined });
  const crop = block.crop;
  const pct = (fraction: number) => Math.round(fraction * 1000) / 10;
  const right = 1 - crop.x - crop.w;
  const bottom = 1 - crop.y - crop.h;
  const setCrop = (left: number, top: number, r: number, b: number) =>
    update({ crop: { x: left, y: top, w: Math.max(0.01, 1 - left - r), h: Math.max(0.01, 1 - top - b) } }, "crop");

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={attachId} className={ADMIN_LABEL}>
          {attached ? "Replace the file" : `Attach "${block.fileName}" again`}
        </label>
        <input
          id={attachId}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onAttach(block.id, file);
          }}
          className="block w-full text-sm text-on-surface file:mr-3 file:min-h-11 file:rounded file:border file:border-outline-variant file:bg-surface-container file:px-3"
        />
        <p className={HELP}>The file stays on this computer. It is not uploaded or saved.</p>
      </div>
      <CheckField
        label="This is the customer's photo"
        checked={block.isCustomerPhoto}
        onChange={(isCustomerPhoto) => update({ isCustomerPhoto })}
      />
      <NumberField
        label="Width"
        suffix="mm"
        value={block.widthMm}
        min={MIN_IMAGE_WIDTH_MM}
        max={MAX_IMAGE_WIDTH_MM}
        step={0.5}
        onCommit={(widthMm) => update({ widthMm }, "width")}
      />
      <div>
        <button type="button" className={SMALL_BUTTON} disabled={!attached} onClick={() => onFillFilm(block.id)}>
          Fill the film
        </button>
        <p className={HELP}>
          For a background: trims the image to the film&apos;s proportions and places it edge to edge. An
          image may reach the film edge exactly; one that runs past it stops the export.
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className={ADMIN_LABEL}>Crop, as a share of the photo</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Trim left" suffix="%" value={pct(crop.x)} min={0} max={95} onCommit={(v) => setCrop(v / 100, crop.y, Math.min(right, 0.99 - v / 100), bottom)} />
          <NumberField label="Trim right" suffix="%" value={pct(right)} min={0} max={95} onCommit={(v) => setCrop(Math.min(crop.x, 0.99 - v / 100), crop.y, v / 100, bottom)} />
          <NumberField label="Trim top" suffix="%" value={pct(crop.y)} min={0} max={95} onCommit={(v) => setCrop(crop.x, v / 100, right, Math.min(bottom, 0.99 - v / 100))} />
          <NumberField label="Trim bottom" suffix="%" value={pct(bottom)} min={0} max={95} onCommit={(v) => setCrop(crop.x, Math.min(crop.y, 0.99 - v / 100), right, v / 100)} />
        </div>
      </fieldset>
      <p className={HELP}>{IMAGE_FILM_REMINDER}</p>
    </div>
  );
}

export function BlockPanel({
  scene,
  selectedId,
  fonts,
  fontStatus,
  attachedIds,
  issues,
  dispatch,
  onSelect,
  onAddText,
  onAddImage,
  onAttach,
  onFillFilm,
}: {
  scene: Scene;
  selectedId: string | null;
  fonts: readonly EditorFont[];
  fontStatus: Readonly<Record<string, FontStatus>>;
  attachedIds: ReadonlySet<string>;
  issues: readonly Issue[];
  dispatch: (action: Action) => void;
  onSelect: (id: string | null) => void;
  onAddText: (preset: "hero" | "verse") => void;
  onAddImage: (file: File, isCustomerPhoto: boolean) => void;
  onAttach: (blockId: string, file: File) => void;
  onFillFilm: (blockId: string) => void;
}) {
  const photoId = useId();
  const artId = useId();
  const selected = scene.blocks.find((block) => block.id === selectedId) ?? null;
  const textCount = scene.blocks.filter((b) => b.kind === "text").length;
  const imageCount = scene.blocks.length - textCount;
  const canAddText = textCount < MAX_TEXT_BLOCKS && fonts.length > 0;
  const canAddImage = imageCount < MAX_IMAGE_BLOCKS;
  const update = (patch: Partial<TextBlock> & Partial<ImageBlock>, key?: string) => {
    if (selected) {
      dispatch({ type: "update", id: selected.id, patch, coalesceKey: key ? `${selected.id}:${key}` : undefined });
    }
  };

  return (
    <section aria-labelledby="ke-blocks-title" className={PANEL}>
      <h2 id="ke-blocks-title" className={PANEL_TITLE}>
        2. Text and images
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SMALL_BUTTON} disabled={!canAddText} onClick={() => onAddText("hero")}>
          Add hero word
        </button>
        <button type="button" className={SMALL_BUTTON} disabled={!canAddText} onClick={() => onAddText("verse")}>
          Add verse
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor={photoId} className={ADMIN_LABEL}>
            Add the customer&apos;s photo
          </label>
          <input
            id={photoId}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={!canAddImage}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAddImage(file, true);
            }}
            className="block w-full text-sm text-on-surface file:mr-3 file:min-h-11 file:rounded file:border file:border-outline-variant file:bg-surface-container file:px-3"
          />
        </div>
        <div>
          <label htmlFor={artId} className={ADMIN_LABEL}>
            Add artwork (background or ornament)
          </label>
          <input
            id={artId}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={!canAddImage}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAddImage(file, false);
            }}
            className="block w-full text-sm text-on-surface file:mr-3 file:min-h-11 file:rounded file:border file:border-outline-variant file:bg-surface-container file:px-3"
          />
        </div>
      </div>
      <p className={HELP}>
        Up to {MAX_TEXT_BLOCKS} text blocks and {MAX_IMAGE_BLOCKS} images. JPEG, PNG or WebP, 25 MB or less.
        Photos stay on this computer.
      </p>

      {scene.blocks.length > 0 && (
        <ul aria-label="Blocks, from bottom to top" className="space-y-1">
          {scene.blocks.map((block) => {
            const blockIssues = issues.filter((issue) => issue.blockId === block.id);
            const stops = blockIssues.some((issue) => issue.level === "block");
            return (
              <li key={block.id}>
                <button
                  type="button"
                  aria-pressed={block.id === selectedId}
                  onClick={() => onSelect(block.id === selectedId ? null : block.id)}
                  className={`w-full min-h-11 rounded border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                    block.id === selectedId
                      ? "border-secondary bg-surface-container-high text-on-surface"
                      : "border-outline-variant text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="font-semibold">{LAYER_LABELS[block.layer]}</span> · {blockTitle(block)}
                  {stops ? " · stops export" : blockIssues.some((issue) => issue.level === "warn") ? " · check" : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="space-y-3 border-t border-surface-variant pt-4">
          <h3 className="font-body-md text-body-md font-semibold text-on-background">{blockTitle(selected)}</h3>
          <IssueList issues={issues.filter((issue) => issue.blockId === selected.id)} />
          {selected.kind === "text" ? (
            <TextControls key={selected.id} block={selected} fonts={fonts} fontStatus={fontStatus} dispatch={dispatch} />
          ) : (
            <ImageControls
              block={selected}
              attached={attachedIds.has(selected.id)}
              dispatch={dispatch}
              onAttach={onAttach}
              onFillFilm={onFillFilm}
            />
          )}
          <SelectField<LayerId>
            label="Film layer"
            value={selected.layer}
            options={LAYER_OPTIONS}
            onChange={(layer) => update({ layer })}
          />
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label={selected.kind === "text" ? "Anchor from left" : "From left"}
              suffix="mm"
              value={selected.xMm}
              min={-POSITION_LIMIT_MM}
              max={POSITION_LIMIT_MM}
              step={0.5}
              onCommit={(xMm) => update({ xMm }, "x")}
            />
            <NumberField
              label="From top"
              suffix="mm"
              value={selected.yMm}
              min={-POSITION_LIMIT_MM}
              max={POSITION_LIMIT_MM}
              step={0.5}
              onCommit={(yMm) => update({ yMm }, "y")}
            />
            <NumberField
              label="Rotation"
              suffix="°"
              value={selected.rotationDeg}
              min={-360}
              max={360}
              onCommit={(rotationDeg) => update({ rotationDeg }, "rotation")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SMALL_BUTTON} onClick={() => dispatch({ type: "reorder", id: selected.id, direction: "up" })}>
              Bring forward
            </button>
            <button type="button" className={SMALL_BUTTON} onClick={() => dispatch({ type: "reorder", id: selected.id, direction: "down" })}>
              Send back
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                dispatch({ type: "remove", id: selected.id });
                onSelect(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
