import type {
  ProductMock,
  ProductVariantMock,
} from "@/components/studio/ProductSelectionModal";
import { formatMinor, toBigIntMinor } from "@/lib/money";
import {
  calculateDigitalQuote,
  calculateItemQuote,
  type ItemQuote,
} from "@/lib/pricing/quote";
import type { PlacementValue } from "@/lib/print/types";
import type { FulfillmentFormat } from "./studioStore";

export interface StudioLiveQuote {
  isDigital: boolean;
  totalMinor: bigint;
  subtotalMinor: bigint;
  artworkMinor: bigint;
  personalizationMinor: bigint;
  productMinor: bigint;
  placementFeeMinor: bigint;
  totalFormatted: string;
  subtotalFormatted: string;
  artworkFormatted: string;
  personalizationFormatted: string;
  productFormatted: string;
  placementFeeFormatted: string;
  unavailableReason: string | null;
}

function formatQuoteModel(quote: ItemQuote): StudioLiveQuote {
  return {
    isDigital: quote.isDigital,
    totalMinor: quote.subtotalMinor,
    subtotalMinor: quote.subtotalMinor,
    artworkMinor: quote.artworkMinor,
    personalizationMinor: quote.personalizationMinor,
    productMinor: quote.productMinor,
    placementFeeMinor: quote.placementFeeMinor,
    totalFormatted: formatMinor(quote.subtotalMinor, quote.currency),
    subtotalFormatted: formatMinor(quote.subtotalMinor, quote.currency),
    artworkFormatted: formatMinor(quote.artworkMinor, quote.currency),
    personalizationFormatted: formatMinor(
      quote.personalizationMinor,
      quote.currency
    ),
    productFormatted: formatMinor(quote.productMinor, quote.currency),
    placementFeeFormatted: formatMinor(
      quote.placementFeeMinor,
      quote.currency
    ),
    unavailableReason: null,
  };
}

export function computeStudioLiveQuote(params: {
  fulfillmentFormat: FulfillmentFormat;
  selectedProduct?: ProductMock;
  selectedVariant?: ProductVariantMock;
  placement: PlacementValue;
}): StudioLiveQuote {
  if (params.fulfillmentFormat === "DIGITAL") {
    const digitalQuote = calculateDigitalQuote({ quantity: 1 });
    return formatQuoteModel(digitalQuote);
  }

  const product = params.selectedProduct;
  const variant =
    params.selectedVariant ?? product?.variants?.[0] ?? undefined;

  if (!product || !variant) {
    const fallbackDigital = calculateDigitalQuote({ quantity: 1 });
    return {
      ...formatQuoteModel(fallbackDigital),
      isDigital: false,
      unavailableReason:
        "Physical catalog refreshing — switch to 300 DPI Digital Master or save draft.",
    };
  }

  try {
    const rawMinorStr = variant.retailPriceMinor || product.priceMinor;
    const baseRetailMinor = toBigIntMinor(rawMinorStr);
    const physicalQuote = calculateItemQuote({
      isDigital: false,
      variant: {
        id: variant.id,
        active: true,
        baseRetailMinor,
        product: { status: "ACTIVE" },
      },
      placement: params.placement,
      quantity: 1,
      isPersonalized: true,
    });
    return formatQuoteModel(physicalQuote);
  } catch {
    const fallbackDigital = calculateDigitalQuote({ quantity: 1 });
    return {
      ...formatQuoteModel(fallbackDigital),
      isDigital: false,
      unavailableReason: "Select an active product variant to calculate price.",
    };
  }
}
