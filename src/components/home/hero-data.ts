export type HeroSlideId = "name" | "poetry" | "heritage";

export type HeroSlide = {
  id: HeroSlideId;
  index: string;
  label: string;
  artworkLabel: string;
  image: string;
  alt: string;
  primaryScript: string;
  semanticTranslation: string;
  scriptStyle: string;
  textColor: string;
  containerStyle: string;
  hasSeal: boolean;
};

export const heroSlides: HeroSlide[] = [
  {
    id: "name",
    index: "01.",
    label: "NAME",
    artworkLabel: "NAME · WEARABLE EDITION",
    image: "/mockups/blank_hoodie.jpg",
    alt: "Personalized Thi Bút name calligraphy on apparel",
    primaryScript: "デイビッド",
    semanticTranslation: "DAVID",
    scriptStyle: "font-jp-yuji-syuku font-bold tracking-widest leading-none [writing-mode:vertical-rl]",
    textColor: "text-[#F6F1E7]",
    containerStyle: "top-[58%] w-[35%] @container",
    hasSeal: true
  },
  {
    id: "poetry",
    index: "02.",
    label: "POETRY",
    artworkLabel: "POETRY · GALLERY EDITION",
    image: "/mockups/fine-art-poster.jpg",
    alt: "Poetic Thi Bút calligraphy artwork",
    primaryScript: "心不變",
    semanticTranslation: "POETIC INTERPRETATION: A STILL MIND",
    scriptStyle: "font-cn-mashan font-medium tracking-normal leading-tight [writing-mode:vertical-rl]",
    textColor: "text-[#0B0B0B]",
    containerStyle: "top-[48%] w-[40%] @container",
    hasSeal: true
  },
  {
    id: "heritage",
    index: "03.",
    label: "HERITAGE",
    artworkLabel: "HERITAGE · FAMILY EDITION",
    image: "/mockups/fine-art-poster.jpg",
    alt: "Thi Bút heritage-inspired family name artwork",
    primaryScript: "阮",
    semanticTranslation: "FAMILY NAME STUDY: NGUYỄN",
    scriptStyle: "font-cn-mashan font-bold tracking-normal leading-tight",
    textColor: "text-[#0B0B0B]",
    containerStyle: "top-[48%] w-[40%] @container",
    hasSeal: false
  }
];
