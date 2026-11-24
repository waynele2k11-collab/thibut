"use client";

import { useId } from "react";
import { ADMIN_BUTTON, ADMIN_LABEL } from "@/components/admin/AdminNotice";
import type { Issue } from "@/lib/keepsake-editor/issues";
import type { Action } from "@/lib/keepsake-editor/reducer";
import { LAYER_IDS, LAYER_LABELS, type LayerId, type Scene } from "@/lib/keepsake-editor/scene";
import type { SheetSpec } from "@/lib/keepsake-editor/units";
import { CONCEPT_PREVIEW_BAND } from "./draw";
import { CheckField, HELP, PANEL, PANEL_TITLE, SMALL_BUTTON } from "./fields";

export function ExportPanel({
  scene,
  sheet,
  layers,
  described,
  accepted,
  jobCode,
  busy,
  canUndo,
  dispatch,
  onAccept,
  onDownloadAll,
  onDownloadLayer,
  onDownloadPreview,
  onSaveProject,
  onOpenProject,
}: {
  scene: Scene;
  sheet: SheetSpec | null;
  /** Layers that get a film, back to front. */
  layers: readonly LayerId[];
  /** Every issue of the scene with the name of its block, blocking ones first. */
  described: readonly { issue: Issue; label: string }[];
  /** The admin ticked "Download anyway" for the warnings as they stand now. */
  accepted: boolean;
  /** The job code of the last download, when the project has not changed since. */
  jobCode: string | null;
  busy: boolean;
  canUndo: boolean;
  dispatch: (action: Action) => void;
  onAccept: (accepted: boolean) => void;
  onDownloadAll: () => void;
  onDownloadLayer: (layer: LayerId) => void;
  onDownloadPreview: () => void;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
}) {
  const openId = useId();
  const blocking = described.filter((d) => d.issue.level === "block");
  const warnings = described.filter((d) => d.issue.level === "warn");
  const notes = described.filter((d) => d.issue.level === "note");
  const disabled = busy || !sheet || blocking.length > 0 || layers.length === 0 || (warnings.length > 0 && !accepted);
  const filmCount = layers.length;

  return (
    <section aria-labelledby="ke-export-title" className={PANEL}>
      <h2 id="ke-export-title" className={PANEL_TITLE}>
        3. Print files
      </h2>
      <CheckField
        label="Mirror the films"
        help="Flips every layer left to right. Use it only when the printed side will face away from the viewer."
        checked={scene.mirror}
        onChange={(mirror) => dispatch({ type: "setMirror", mirror })}
      />
      <CheckField
        label="Crop marks in a 5 mm border"
        help="Adds corner marks and a label outside the film area. Switch it off if the print shop wants the film area only."
        checked={scene.cropBorder}
        onChange={(cropBorder) => dispatch({ type: "setCropBorder", cropBorder })}
      />
      <CheckField
        label="Registration dots inside the film"
        help="A small dot 2 mm inside each corner of every layer, for lining films up when the edges cannot be used. The dots are printed."
        checked={scene.innerMarks}
        onChange={(innerMarks) => dispatch({ type: "setInnerMarks", innerMarks })}
      />

      <div className="space-y-2" aria-live="polite">
        <p className={ADMIN_LABEL}>Checks before download</p>
        {described.length === 0 && layers.length > 0 && <p className={HELP}>No problems found.</p>}
        {layers.length === 0 && <p className={HELP}>Add text or an image to make a print file.</p>}
        {blocking.length > 0 && (
          <div role="alert" className="rounded border border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
            <p className="font-semibold">Fix these before downloading print files or the preview:</p>
            <ul className="list-disc pl-5">
              {blocking.map((d) => (
                <li key={`${d.issue.blockId}:${d.issue.message}`}>
                  <span className="font-semibold">{d.label}.</span> {d.issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface">
            <p className="font-semibold">
              {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}. Read before downloading:
            </p>
            <ul className="list-disc pl-5">
              {warnings.map((d) => (
                <li key={`${d.issue.blockId}:${d.issue.message}`}>
                  <span className="font-semibold">{d.label}.</span> {d.issue.message}
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <CheckField
                label="Download anyway"
                help="I have read these warnings. The tick clears when the warnings change."
                checked={accepted}
                onChange={onAccept}
              />
            </div>
          </div>
        )}
        {notes.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-on-surface-variant">
            {notes.map((d) => (
              <li key={`${d.issue.blockId}:${d.issue.message}`}>
                Note: <span className="font-semibold">{d.label}.</span> {d.issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className={ADMIN_LABEL}>
          {filmCount === 0
            ? "One transparent PNG for each film"
            : `${filmCount} film${filmCount === 1 ? "" : "s"} in this set: ${layers.map((layer) => LAYER_LABELS[layer]).join(", ")}`}
        </p>
        <button type="button" className={ADMIN_BUTTON} disabled={disabled} onClick={onDownloadAll}>
          Download all films and the preview
        </button>
        <p className={HELP}>
          Use this button for real orders. Every file comes from the same state of the project and carries
          the same job code, on its border label and in its file name. Films whose job codes differ do not
          belong together. Your browser may ask once to allow several downloads.
        </p>
        <p className={HELP} role="status">
          {jobCode
            ? `Job code of the last download: ${jobCode}. The project has not changed since.`
            : "The next download gets a new job code."}
        </p>
        <div className="flex flex-wrap gap-2">
          {LAYER_IDS.filter((layer) => layers.includes(layer)).map((layer) => (
            <button key={layer} type="button" className={SMALL_BUTTON} disabled={disabled} onClick={() => onDownloadLayer(layer)}>
              {LAYER_LABELS[layer]} film only
            </button>
          ))}
        </div>
        <p className={HELP}>
          Every layer has the same pixel size, so the films stack by their edges. Print at 100%, without
          &quot;fit to page&quot;. A layer with no artwork gets no film.
        </p>
      </div>

      <div className="space-y-2">
        <p className={ADMIN_LABEL}>Preview for the customer&apos;s proof</p>
        <button type="button" className={SMALL_BUTTON} disabled={disabled} onClick={onDownloadPreview}>
          Preview only
        </button>
        <p className={HELP}>The preview always carries this line: &quot;{CONCEPT_PREVIEW_BAND}&quot;</p>
      </div>

      <div className="space-y-2 border-t border-surface-variant pt-4">
        <p className={ADMIN_LABEL}>Project file</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={onSaveProject}>
            Save project file
          </button>
          <button type="button" className={SMALL_BUTTON} disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>
            Undo last change
          </button>
        </div>
        <div>
          <label htmlFor={openId} className={ADMIN_LABEL}>
            Open a project file
          </label>
          <input
            id={openId}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onOpenProject(file);
            }}
            className="block w-full text-sm text-on-surface file:mr-3 file:min-h-11 file:rounded file:border file:border-outline-variant file:bg-surface-container file:px-3"
          />
        </div>
        <p className={HELP}>
          The project file holds the text, sizes and positions, and each image&apos;s file name. It does not
          hold the images: attach them again after opening. It is named after the project, and an image
          file name may hold a customer&apos;s name, so keep the project file as private as the photo.
        </p>
      </div>
    </section>
  );
}
