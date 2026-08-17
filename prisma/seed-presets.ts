import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRESETS = [
  {
    key: "zen-ivory",
    name: "Zen Ivory",
    category: "Zen",
    description: "A soft, warm ivory paper texture with subtle natural grain.",
    promptTemplate: "Create an elegant editorial background for East Asian calligraphy presentation. Style: Zen minimalist paper. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Soft, warm ivory paper texture with subtle natural grain. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Calm",
    defaultPalette: "Ivory / Ink",
    defaultIntensity: "Minimal",
    sortOrder: 1,
  },
  {
    key: "sumi-mist",
    name: "Sumi Mist",
    category: "Abstract",
    description: "Atmospheric ink wash clouds dissipating in negative space.",
    promptTemplate: "Create an elegant editorial background for East Asian calligraphy presentation. Style: Sumi-e ink wash mist. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Atmospheric ink wash clouds dissipating in negative space. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Mysterious",
    defaultPalette: "Beige / Black",
    defaultIntensity: "Medium",
    sortOrder: 2,
  },
  {
    key: "bamboo-shadow",
    name: "Bamboo Shadow",
    category: "Nature",
    description: "Soft silhouettes of bamboo leaves cast against a paper screen.",
    promptTemplate: "Create an elegant editorial background for East Asian calligraphy presentation. Style: Bamboo shadows on shoji screen. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Soft silhouettes of bamboo leaves cast against a paper screen. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Spiritual",
    defaultPalette: "Soft Gold",
    defaultIntensity: "Minimal",
    sortOrder: 3,
  }
];

async function main() {
  console.log("Seeding Background Presets...");

  for (const preset of PRESETS) {
    await prisma.backgroundPreset.upsert({
      where: { key: preset.key },
      update: preset,
      create: preset,
    });
    console.log(`- Upserted preset: ${preset.name}`);
  }

  console.log("✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
