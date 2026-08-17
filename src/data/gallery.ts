export type GalleryCategory = "NAME" | "POETRY" | "HERITAGE";
export type ProductType = "TEE" | "HOODIE" | "TANK" | "WALL_ART";
export type InterpretationType = "PHONETIC" | "LITERAL" | "NATURAL" | "POETIC" | "HERITAGE_STUDY" | "CULTURAL";
export type PrintPlacement = "FRONT_CENTER" | "LEFT_CHEST" | "BACK_CENTER" | "FRONT_AND_BACK";

export type MockupView = {
  asset: string;
  view: "FRONT" | "BACK" | "DETAIL" | "ENVIRONMENT";
};

export type DesignFixture = {
  id: string;
  sourceText: string;
  renderedText: string;
  romanization?: string;
  language: string;
  styleName: string;
  interpretationType: InterpretationType;
  meaning: string;
  creatorName: string;
};

export type GalleryProductFixture = {
  id: string;
  slug: string;
  title: string;

  design: DesignFixture;
  
  productId: string;
  productName: string;
  productType: ProductType;
  color: string;
  placement: PrintPlacement;

  retailPriceMinor: number;
  currency: string;

  mockups: MockupView[];

  category: GalleryCategory;

  featured: boolean;
  active: boolean;
};

export const galleryProducts: GalleryProductFixture[] = [
  {
    id: "gp_001",
    slug: "david-dai-ve",
    title: "David / 大衛 / Đại Vệ",
    design: {
      id: "ds_001",
      sourceText: "David",
      renderedText: "大衛",
      romanization: "Đại Vệ",
      language: "Vietnamese",
      styleName: "Sino-Vietnamese Brush",
      interpretationType: "CULTURAL",
      meaning: "Sino-Vietnamese artistic rendering. Not a literal translation, but a meaningful cultural equivalent.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_hw_tee_01",
    productName: "Premium Heavyweight Tee",
    productType: "TEE",
    color: "Black",
    placement: "FRONT_CENTER",
    retailPriceMinor: 4800,
    currency: "USD",
    mockups: [
      { asset: "/gallery/david-tee.jpg", view: "FRONT" }
    ],
    category: "NAME",
    featured: true,
    active: true,
  },
  {
    id: "gp_002",
    slug: "never-give-up",
    title: "Never Give Up",
    design: {
      id: "ds_002",
      sourceText: "Never Give Up",
      renderedText: "諦めない",
      romanization: "Akiramenai",
      language: "Japanese",
      styleName: "Shodō Minimal",
      interpretationType: "NATURAL",
      meaning: "Direct, imperative form — powerful and clear in this language.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_hw_tee_01",
    productName: "Premium Heavyweight Tee",
    productType: "TEE",
    color: "Black",
    placement: "FRONT_CENTER",
    retailPriceMinor: 4800,
    currency: "USD",
    mockups: [
      { asset: "/gallery/never-give-up-tee.jpg", view: "FRONT" }
    ],
    category: "POETRY",
    featured: true,
    active: true,
  },
  {
    id: "gp_003",
    slug: "still-mind",
    title: "Still Mind",
    design: {
      id: "ds_003",
      sourceText: "Still Mind",
      renderedText: "心不變",
      romanization: "Xīn bù biàn",
      language: "Chinese",
      styleName: "Ink Minimal",
      interpretationType: "POETIC",
      meaning: "A poetic interpretation: A still mind in a turbulent world.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_poster_01",
    productName: "Gallery Quality Fine Art Print",
    productType: "WALL_ART",
    color: "Ivory",
    placement: "FRONT_CENTER",
    retailPriceMinor: 3500,
    currency: "USD",
    mockups: [
      { asset: "/gallery/still-mind-print.jpg", view: "FRONT" }
    ],
    category: "POETRY",
    featured: true,
    active: true,
  },
  {
    id: "gp_004",
    slug: "nguyen-family",
    title: "Nguyễn",
    design: {
      id: "ds_004",
      sourceText: "Nguyen",
      renderedText: "阮",
      romanization: "Nguyễn",
      language: "Vietnamese",
      styleName: "Heritage Seal",
      interpretationType: "HERITAGE_STUDY",
      meaning: "Heritage family name study. An exploration of the traditional Hán-Nôm character.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_poster_01",
    productName: "Gallery Quality Fine Art Print",
    productType: "WALL_ART",
    color: "Ivory",
    placement: "FRONT_CENTER",
    retailPriceMinor: 3500,
    currency: "USD",
    mockups: [
      { asset: "/gallery/nguyen-seal-print.jpg", view: "FRONT" }
    ],
    category: "HERITAGE",
    featured: false,
    active: true,
  },
  {
    id: "gp_005",
    slug: "fall-seven-rise-eight",
    title: "Fall Seven, Rise Eight",
    design: {
      id: "ds_005",
      sourceText: "Fall Seven Times, Rise Eight",
      renderedText: "七転八起",
      romanization: "Shichitenhakki",
      language: "Japanese",
      styleName: "Classic",
      interpretationType: "POETIC",
      meaning: "Classical 4-character idiom (Yojijukugo). Deeply resonant in East Asian culture.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_hw_hoodie_01",
    productName: "Premium Heavyweight Hoodie",
    productType: "HOODIE",
    color: "Black",
    placement: "FRONT_CENTER",
    retailPriceMinor: 6900,
    currency: "USD",
    mockups: [
      { asset: "/gallery/fall-seven-hoodie.jpg", view: "FRONT" }
    ],
    category: "POETRY",
    featured: false,
    active: true,
  },
  {
    id: "gp_006",
    slug: "sarah-phonetic",
    title: "Sarah (Phonetic)",
    design: {
      id: "ds_006",
      sourceText: "Sarah",
      renderedText: "세라",
      romanization: "Sera",
      language: "Korean",
      styleName: "Modern Hangul",
      interpretationType: "PHONETIC",
      meaning: "Phonetic transliteration into native script.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_hw_hoodie_01",
    productName: "Premium Heavyweight Hoodie",
    productType: "HOODIE",
    color: "Black",
    placement: "FRONT_CENTER",
    retailPriceMinor: 6900,
    currency: "USD",
    mockups: [
      { asset: "/gallery/sarah-hangul-hoodie.jpg", view: "FRONT" }
    ],
    category: "NAME",
    featured: false,
    active: true,
  },
  {
    id: "gp_007",
    slug: "strength-literal",
    title: "Strength",
    design: {
      id: "ds_007",
      sourceText: "Strength",
      renderedText: "Sức Mạnh",
      romanization: "Sức Mạnh",
      language: "Vietnamese",
      styleName: "Street",
      interpretationType: "LITERAL",
      meaning: "Literal translation. Strong, emphatic statement.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_hw_tee_01",
    productName: "Premium Heavyweight Tee",
    productType: "TEE",
    color: "Black",
    placement: "LEFT_CHEST",
    retailPriceMinor: 4800,
    currency: "USD",
    mockups: [
      { asset: "/gallery/strength-tee.jpg", view: "FRONT" }
    ],
    category: "POETRY",
    featured: false,
    active: true,
  },
  {
    id: "gp_008",
    slug: "tran-family",
    title: "Trần",
    design: {
      id: "ds_008",
      sourceText: "Tran",
      renderedText: "陳",
      romanization: "Trần",
      language: "Vietnamese",
      styleName: "Heritage Seal",
      interpretationType: "HERITAGE_STUDY",
      meaning: "Heritage family name study. An exploration of the traditional Hán-Nôm character.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_poster_01",
    productName: "Gallery Quality Fine Art Print",
    productType: "WALL_ART",
    color: "Ivory",
    placement: "FRONT_CENTER",
    retailPriceMinor: 3500,
    currency: "USD",
    mockups: [
      { asset: "/gallery/tran-seal-print.jpg", view: "FRONT" }
    ],
    category: "HERITAGE",
    featured: false,
    active: true,
  },
  {
    id: "gp_009",
    slug: "michael-cultural",
    title: "Michael",
    design: {
      id: "ds_009",
      sourceText: "Michael",
      renderedText: "マイケル",
      romanization: "Maikeru",
      language: "Japanese",
      styleName: "Shodō",
      interpretationType: "PHONETIC",
      meaning: "Phonetic transliteration into Katakana.",
      creatorName: "Thi Bút Studio",
    },
    productId: "prod_poster_01",
    productName: "Gallery Quality Fine Art Print",
    productType: "WALL_ART",
    color: "Ivory",
    placement: "FRONT_CENTER",
    retailPriceMinor: 3500,
    currency: "USD",
    mockups: [
      { asset: "/gallery/michael-katakana-print.jpg", view: "FRONT" }
    ],
    category: "NAME",
    featured: false,
    active: true,
  }
];
