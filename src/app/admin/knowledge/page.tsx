import prisma from "@/lib/prisma";
import { format } from "date-fns";

export default async function AdminKnowledgePage() {
  const knowledgeEntries = await prisma.phraseKnowledge.findMany({
    take: 50,
    orderBy: { usageCount: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Knowledge Cache</h1>
          <p className="font-body text-[#A09D96]">Manage reusable linguistic intelligence and cached interpretations.</p>
        </div>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Input</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Interpretation</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Type / Lang</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Uses</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Last Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {knowledgeEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#111111]">{entry.displayInput}</span>
                    <span className="text-xs text-[#A09D96]">{entry.normalizedInput}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#B3261E]">{entry.renderedText}</span>
                    {entry.romanization && <span className="text-xs text-[#A09D96]">{entry.romanization}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[#4A4844]">{entry.inputType}</span>
                    <span className="text-xs text-[#A09D96]">{entry.interpretationType} • {entry.targetLanguage}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                    entry.verificationStatus === 'HUMAN_VERIFIED' ? 'bg-green-100 text-green-800' : 
                    entry.verificationStatus === 'GENERATED' ? 'bg-yellow-100 text-yellow-800' :
                    entry.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {entry.verificationStatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {entry.usageCount}
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {entry.lastUsedAt ? format(new Date(entry.lastUsedAt), "MMM d, yyyy") : "Never"}
                </td>
              </tr>
            ))}
            {knowledgeEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#A09D96]">No cached knowledge found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
