import prisma from "@/lib/prisma";

export class DesignCacheService {
  /**
   * Look up an existing generated visual design based on deterministic parameters.
   */
  public static async findReusableDesign(params: {
    phraseKnowledgeId: string;
    stylePackId: string;
    rendererVersion: string;
  }) {
    const design = await prisma.generatedDesign.findFirst({
      where: {
        phraseKnowledgeId: params.phraseKnowledgeId,
        stylePackId: params.stylePackId,
        rendererVersion: params.rendererVersion,
      },
      include: {
        variations: true,
      }
    });

    return design;
  }

  /**
   * Store a successful generation into the visual cache with its variations.
   */
  public static async storeRenderedDesign(params: {
    phraseKnowledgeId: string;
    stylePackId: string;
    rendererVersion: string;
    variations: {
      variationIndex: number;
      variationNote: string;
      renderedText: string;
      assetId: string;
      provider: string;
      status: "READY" | "FAILED";
    }[];
  }) {
    const existing = await this.findReusableDesign(params);
    if (existing) {
      return existing;
    }

    return await prisma.generatedDesign.create({
      data: {
        phraseKnowledgeId: params.phraseKnowledgeId,
        stylePackId: params.stylePackId,
        rendererVersion: params.rendererVersion,
        variations: {
          create: params.variations.map(v => ({
            ...v
          }))
        }
      },
      include: {
        variations: true,
      }
    });
  }

  /**
   * Record a usage of a specific generated design.
   */
  public static async recordUsage(id: string) {
    return await prisma.generatedDesign.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }
}
