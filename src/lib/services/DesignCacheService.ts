import prisma from "@/lib/prisma";

export interface DesignCacheKey {
  phraseKnowledgeId: string;
  stylePackId: string;
  rendererVersion: string;
  script: string;
}

export interface DesignVariationCacheInput {
  variationIndex: number;
  variationNote: string;
  renderedText: string;
  assetId: string;
  provider: string;
  status: "READY" | "FAILED";
}

export class DesignCacheService {
  /**
   * Deterministic lookup keyed on `(phraseKnowledgeId, stylePackId, rendererVersion, script)`
   * enforcing TB-CALLI-010 and T-403.
   */
  public static async findReusableDesign(params: DesignCacheKey) {
    return prisma.generatedDesign.findUnique({
      where: {
        phraseKnowledgeId_stylePackId_rendererVersion_script: {
          phraseKnowledgeId: params.phraseKnowledgeId,
          stylePackId: params.stylePackId,
          rendererVersion: params.rendererVersion,
          script: params.script,
        },
      },
      include: {
        variations: {
          orderBy: { variationIndex: "asc" },
        },
      },
    });
  }

  /**
   * Idempotently persists approved variations under the composite unique key
   * `phraseKnowledgeId_stylePackId_rendererVersion_script` (T-403, T-405).
   */
  public static async storeRenderedDesign(
    params: DesignCacheKey & {
      variations: DesignVariationCacheInput[];
    }
  ) {
    return prisma.generatedDesign.upsert({
      where: {
        phraseKnowledgeId_stylePackId_rendererVersion_script: {
          phraseKnowledgeId: params.phraseKnowledgeId,
          stylePackId: params.stylePackId,
          rendererVersion: params.rendererVersion,
          script: params.script,
        },
      },
      update: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        phraseKnowledgeId: params.phraseKnowledgeId,
        stylePackId: params.stylePackId,
        rendererVersion: params.rendererVersion,
        script: params.script,
        usageCount: 1,
        lastUsedAt: new Date(),
        variations: {
          create: params.variations.map((v) => ({
            variationIndex: v.variationIndex,
            variationNote: v.variationNote,
            renderedText: v.renderedText,
            assetId: v.assetId,
            provider: v.provider,
            status: v.status,
          })),
        },
      },
      include: {
        variations: {
          orderBy: { variationIndex: "asc" },
        },
      },
    });
  }

  /**
   * Increments usage count on cache hit.
   */
  public static async recordUsage(id: string) {
    return prisma.generatedDesign.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }
}
