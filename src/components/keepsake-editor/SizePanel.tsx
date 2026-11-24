"use client";

import { ADMIN_FIELD, ADMIN_LABEL } from "@/components/admin/AdminNotice";
import type { Action } from "@/lib/keepsake-editor/reducer";
import { MAX_NAME_CHARS, MAX_SAFE_ZONE_MM, type Scene } from "@/lib/keepsake-editor/scene";
import { KEEPSAKE_SIZES, KEEPSAKE_SIZES_NOTE } from "@/lib/keepsake-editor/sizes";
import { MAX_PIECE_MM, MIN_FILM_MM, MIN_PIECE_MM, type SheetSpec } from "@/lib/keepsake-editor/units";
import { HELP, NumberField, PANEL, PANEL_TITLE, SelectField } from "./fields";

const CUSTOM = "custom";

export function SizePanel({
  scene,
  sheet,
  dispatch,
}: {
  scene: Scene;
  sheet: SheetSpec | null;
  dispatch: (action: Action) => void;
}) {
  const preset = KEEPSAKE_SIZES.find((s) => s.wMm === scene.pieceWmm && s.hMm === scene.pieceHmm);
  const maxMargin = Math.max(0, Math.floor((Math.min(scene.pieceWmm, scene.pieceHmm) - MIN_FILM_MM) / 2));
  const minSide = Math.max(MIN_PIECE_MM, Math.ceil(MIN_FILM_MM + 2 * scene.marginMm));

  return (
    <section aria-labelledby="ke-size-title" className={PANEL}>
      <h2 id="ke-size-title" className={PANEL_TITLE}>
        1. Piece
      </h2>
      <div>
        <label htmlFor="ke-name" className={ADMIN_LABEL}>
          Project name
        </label>
        <input
          id="ke-name"
          type="text"
          value={scene.name}
          maxLength={MAX_NAME_CHARS}
          onChange={(event) => dispatch({ type: "setName", name: event.target.value })}
          className={ADMIN_FIELD}
        />
        <p className={HELP}>
          Printed on the border label and used to name the project file. Keep customer names out of it.
          Print files are named by job code and layer only.
        </p>
      </div>
      <SelectField
        label="Size"
        value={preset ? preset.id : CUSTOM}
        options={[
          ...KEEPSAKE_SIZES.map((s) => ({ value: s.id, label: s.label })),
          { value: CUSTOM, label: "Custom size" },
        ]}
        onChange={(id) => {
          const next = KEEPSAKE_SIZES.find((s) => s.id === id);
          if (next) dispatch({ type: "setSize", pieceWmm: next.wMm, pieceHmm: next.hMm });
        }}
      />
      <p className={HELP}>{KEEPSAKE_SIZES_NOTE}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Width"
          suffix="mm"
          value={scene.pieceWmm}
          min={minSide}
          max={MAX_PIECE_MM}
          onCommit={(w) => dispatch({ type: "setSize", pieceWmm: w, pieceHmm: scene.pieceHmm })}
        />
        <NumberField
          label="Height"
          suffix="mm"
          value={scene.pieceHmm}
          min={minSide}
          max={MAX_PIECE_MM}
          onCommit={(h) => dispatch({ type: "setSize", pieceWmm: scene.pieceWmm, pieceHmm: h })}
        />
      </div>
      <NumberField
        label="Safe margin on each side"
        suffix="mm"
        value={scene.marginMm}
        min={0}
        max={maxMargin}
        step={0.5}
        onCommit={(m) => dispatch({ type: "setMargin", marginMm: m })}
      />
      <NumberField
        label="Safe zone inside the film edge"
        suffix="mm"
        value={scene.safeZoneMm}
        min={0}
        max={MAX_SAFE_ZONE_MM}
        step={0.5}
        onCommit={(z) => dispatch({ type: "setSafeZone", safeZoneMm: z })}
      />
      <p className={HELP}>
        The dotted line in the preview. A block between it and the film edge may be trimmed when the film
        is cut, and is flagged before download. The line is never printed. There is no bleed: a block
        that runs past the film edge stops the export.
      </p>
      {sheet && (
        <p className={HELP} role="status">
          Film: {round1(sheet.filmWmm)} × {round1(sheet.filmHmm)} mm, {sheet.filmWpx} × {sheet.filmHpx} px
          at {sheet.dpi} pixels per inch.
          {sheet.reduced
            ? ` This piece is large, so the print resolution is lowered from 300 to ${sheet.dpi} pixels per inch.`
            : ""}
        </p>
      )}
    </section>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
