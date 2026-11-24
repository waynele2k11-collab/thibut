import type { Metadata } from "next";
import { KeepsakeEditorLoader } from "@/components/keepsake-editor/KeepsakeEditorLoader";
import { getEligibleFonts } from "@/lib/keepsake-editor/eligible-fonts.server";
import { requireAdmin } from "@/utils/admin/auth";

export const metadata: Metadata = {
  title: "Keepsake Editor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminKeepsakeEditorPage() {
  await requireAdmin();
  const fonts = (await getEligibleFonts()).map(({ id, name, covered, note }) => ({
    id,
    name,
    covered,
    ...(note ? { note } : {}),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-background mb-2">Keepsake Editor</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Lay out a custom piece and download one print file for each clear film.
        </p>
      </div>
      <section
        aria-labelledby="ke-howto"
        className="bg-surface-container-lowest border border-surface-variant rounded-lg p-4"
      >
        <h2 id="ke-howto" className="font-headline-sm text-headline-sm text-on-background mb-2">
          How to use it
        </h2>
        <ol className="list-decimal pl-5 space-y-1 font-body-md text-body-md text-on-surface">
          <li>Pick the piece size, or type the width and height in millimetres.</li>
          <li>
            Add a hero word and a verse. Type the text yourself: it is drawn from the real font file, and
            a letter the font does not have is named and stops the export.
          </li>
          <li>Add the customer&apos;s photo and any artwork. The files stay on this computer.</li>
          <li>
            Give each block a film layer: Back, Middle or Front. Drag blocks in the preview to place them.
            Keep everything inside the dashed film edge; a block that runs off the film stops the export.
          </li>
          <li>
            Press &quot;Download all films&quot; so every film comes from the same state of the project and
            carries the same job code. Download the preview for the customer&apos;s proof, and save the
            project file to continue later.
          </li>
        </ol>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">
          Clear film has no white ink: light colours print faint, and the look must be checked on a real
          film. Nothing is saved on the server; closing the page loses unsaved work.
        </p>
      </section>
      <KeepsakeEditorLoader fonts={fonts} />
    </div>
  );
}
