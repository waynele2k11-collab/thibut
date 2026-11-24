/**
 * Storefront divisions and subcategories from Business Requirements v1.0 (§02–04).
 * This is seed/reference data: at runtime the storefront reads the Category table,
 * so administrators can add, rename or retire categories without a deploy.
 */

export interface DivisionSeed {
  slug: "personal" | "business" | "living";
  name: string;
  tagline: string;
  subcategories: readonly { slug: string; name: string; inputs: string }[];
}

export const DIVISION_SLUGS = ["personal", "business", "living"] as const;
export type DivisionSlug = (typeof DIVISION_SLUGS)[number];

export function isDivisionSlug(value: string): value is DivisionSlug {
  return (DIVISION_SLUGS as readonly string[]).includes(value);
}

export const DIVISIONS: readonly DivisionSeed[] = [
  {
    slug: "personal",
    name: "Personal",
    tagline: "Weddings, love, family, milestones and remembrance.",
    subcategories: [
      { slug: "wedding-engagement", name: "Wedding & Engagement", inputs: "Couple photos, names, wedding date, verse." },
      { slug: "anniversary", name: "Anniversary", inputs: "Portraits, years together, romantic message." },
      { slug: "parents-family", name: "Parents & Family", inputs: "Family photos, gratitude verse." },
      { slug: "birthday-friendship", name: "Birthday & Friendship", inputs: "Portraits, age, wishes or friendship quote." },
      { slug: "graduation", name: "Graduation", inputs: "Graduate photo, school, degree, year." },
      { slug: "memorial", name: "Memorial & Pet Memorial", inputs: "Portrait, name, remembrance dates, tribute." },
      { slug: "new-baby", name: "New Baby", inputs: "Baby photo, name, birth details." },
      { slug: "religious-spiritual", name: "Religious & Spiritual", inputs: "Prayer, scripture or spiritual artwork." },
    ],
  },
  {
    slug: "business",
    name: "Business",
    tagline: "Grand openings, awards, real estate gifts, recognition and branded products.",
    subcategories: [
      { slug: "grand-opening", name: "Grand Opening", inputs: "Business name, logo, storefront, opening date, prosperity verse." },
      { slug: "awards-trophies", name: "Awards & Trophies", inputs: "Recipient, achievement, award title, date." },
      { slug: "real-estate-closing", name: "Real Estate Closing", inputs: "House photo, decorative key, family name, closing date." },
      { slug: "corporate-gifts", name: "Corporate Gifts", inputs: "Logo, recipient, appreciation message." },
      { slug: "employee-recognition", name: "Employee Recognition & Retirement", inputs: "Photo, achievements, years of service." },
      { slug: "company-anniversary", name: "Company Anniversary", inputs: "Brand identity, milestone, years in business." },
      { slug: "sports-awards", name: "Sports Awards", inputs: "Team logo, athlete, achievement." },
      { slug: "professional-appreciation", name: "Professional Appreciation", inputs: "Profession, recipient, contribution." },
      { slug: "business-signage", name: "Business Signage", inputs: "Logo, brand message, reception artwork." },
    ],
  },
  {
    slug: "living",
    name: "Living",
    tagline: "Wall art, tabletops, decorative trays and commercial interiors.",
    subcategories: [
      { slug: "wall-art", name: "Wall Art", inputs: "Dimensions, theme, colors, frame, layers." },
      { slug: "tabletops", name: "Tabletops", inputs: "Shape, dimensions, artwork, thickness, support." },
      { slug: "feng-shui", name: "Feng Shui", inputs: "Koi, eight horses, dragons, prosperity trees." },
      { slug: "nature-landscape", name: "Nature & Landscape", inputs: "Ocean, mountains, forests, waterfalls." },
      { slug: "botanical", name: "Botanical", inputs: "Orchids, lotus, magnolia, cherry blossoms." },
      { slug: "poetry-calligraphy", name: "Poetry & Calligraphy", inputs: "Verse, typography, language, layout." },
      { slug: "abstract-seasonal", name: "Abstract & Seasonal Art", inputs: "Palettes, patterns, metallic effects, holiday themes." },
      { slug: "decorative-trays", name: "Decorative Trays", inputs: "Shape, artwork, decorative accents." },
      { slug: "commercial-interiors", name: "Commercial Interiors", inputs: "Logo, reception panels, decorative surfaces." },
    ],
  },
];

/** Category.slug is globally unique, so subcategories are stored as `<division>-<sub>`. */
export function categorySlug(division: DivisionSlug, subcategory: string): string {
  return `${division}-${subcategory}`;
}

/** Platform-owned creator that owns catalog artwork (same identity the Studio uses). */
export const PLATFORM_CREATOR_USER_EMAIL = "studio-platform@thibut.internal";
export const PLATFORM_CREATOR_SLUG = "thibut-studio";

export const RESIN_KEEPSAKE_PRODUCT_SLUG = "resin-keepsake-rectangle";
export const RESIN_TABLETOP_PRODUCT_SLUG = "resin-tabletop";

/** 16000 basis points = double-sided is 1.6x the single-sided price (BRD §09). */
export const DEFAULT_DOUBLE_SIDED_MULTIPLIER_BPS = 16000;
