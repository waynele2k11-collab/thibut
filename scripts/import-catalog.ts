import { CatalogSyncService } from "../src/lib/services/CatalogSyncService";

async function main() {
  console.log("Starting Printful Catalog Importer...\n");
  const syncService = new CatalogSyncService();

  const productsToImport = [
    {
      id: 71, // Bella+Canvas 3001
      category: "merch",
      slug: "product-classic-tshirt",
      priceMinor: 4500, // $45.00 retail
      name: "Classic Organic Cotton T-Shirt"
    },
    {
      id: 323, // Cotton Heritage M2480 
      category: "merch",
      slug: "product-premium-hoodie",
      priceMinor: 9900, // $99.00 retail
      name: "Premium Heavyweight Hoodie"
    },
    {
      id: 206, // Yupoong 6245CM
      category: "merch",
      slug: "product-dad-hat",
      priceMinor: 3500, // $35.00 retail
      name: "Classic Dad Hat"
    },
    {
      id: 594, // Tough Case for iPhone
      category: "merch",
      slug: "product-phone-case",
      priceMinor: 2900, // $29.00 retail
      name: "Tough iPhone Case"
    }
  ];

  for (const p of productsToImport) {
    console.log(`\n=================================================`);
    console.log(`Importing ${p.name} (ID: ${p.id})...`);
    console.log(`=================================================`);
    try {
      await syncService.importCatalogProduct(p.id, p.category, p.slug, p.priceMinor);
      console.log(`✅ Successfully imported ${p.name}`);
    } catch (e) {
      console.error(`❌ Failed to import ${p.name}:`, e);
    }
  }

  console.log("\nAll imports completed!");
}

main().catch(console.error);
