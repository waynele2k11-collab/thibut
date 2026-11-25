import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminKnowledgePage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const knowledgeEntries = await prisma.phraseKnowledge.findMany({
    take: 50,
    orderBy: { usageCount: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Knowledge Cache
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage reusable linguistic intelligence and cached interpretations.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Input
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Interpretation
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Type / Lang
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Uses
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Last Used
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {knowledgeEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {entry.displayInput}
                      </span>
                      <span className="font-body-md text-xs text-on-surface-variant">
                        {entry.normalizedInput}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span
                        lang={
                          entry.targetLanguage.toLowerCase().startsWith("vi")
                            ? "vi"
                            : undefined
                        }
                        className="font-medium text-secondary"
                      >
                        {entry.renderedText}
                      </span>
                      {entry.romanization && (
                        <span className="font-body-md text-xs text-on-surface-variant">
                          {entry.romanization}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-body-md text-sm text-on-surface">
                        {entry.inputType}
                      </span>
                      <span className="font-body-md text-xs text-on-surface-variant">
                        {entry.interpretationType} &bull; {entry.targetLanguage}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        entry.verificationStatus === "HUMAN_VERIFIED"
                          ? "default"
                          : entry.verificationStatus === "REJECTED"
                            ? "error"
                            : "outline"
                      }
                    >
                      {entry.verificationStatus}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface">
                    {entry.usageCount}
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {entry.lastUsedAt
                      ? format(new Date(entry.lastUsedAt), "MMM d, yyyy")
                      : "Never"}
                  </td>
                </tr>
              ))}
              {knowledgeEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No cached knowledge found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
