import fs from "fs/promises";
import path from "path";
import https from "https";

const PRINTFUL_API_KEY = "Tzx6b0crTB1bT7uQZADNxPA4MWFPddk10dhD9CmN";

const PRODUCTS = [
  {
    id: 71,
    name: "Classic T-Shirt",
    colors: ["White", "Black", "Navy", "Navy blue"],
  },
  {
    id: 380,
    name: "Premium Hoodie",
    colors: ["White", "Black", "Charcoal gray"],
  },
  {
    id: 1,
    name: "Fine Art Poster",
    colors: [],
  },
  {
    id: 3,
    name: "Canvas Print",
    colors: [],
  },
  {
    id: 19,
    name: "Coffee Mug White",
    colors: [], // just get the default
  },
  {
    id: 300,
    name: "Coffee Mug Black",
    colors: [], // just get the default
  },
  {
    id: 641,
    name: "Tote Bag",
    colors: ["Natural", "Black"],
  },
];

async function fetchPrintfulData(apiPath: string) {
  const res = await fetch(`https://api.printful.com${apiPath}`, {
    headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` },
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(`Printful API Error: ${JSON.stringify(data)}`);
  return data.result;
}

async function downloadImage(url: string, destPath: string) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
        }
        const writeStream = require("fs").createWriteStream(destPath);
        res.pipe(writeStream);
        writeStream.on("finish", () => {
          writeStream.close();
          resolve(true);
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const outDir = path.join(process.cwd(), "public/mockups/printful");
  await fs.mkdir(outDir, { recursive: true });

  for (const product of PRODUCTS) {
    console.log(`Fetching variants for ${product.name} (ID: ${product.id})...`);
    try {
      const result = await fetchPrintfulData(`/products/${product.id}`);
      const variants = result.variants;

      if (!variants || variants.length === 0) {
        console.warn(`No variants found for ${product.name}`);
        continue;
      }

      if (product.colors.length === 0) {
        const variant = variants[0];
        if (variant && variant.image) {
          const ext = variant.image.split(".").pop();
          const filename = `${product.name.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
          const dest = path.join(outDir, filename);
          console.log(`Downloading ${filename}...`);
          await downloadImage(variant.image, dest);
        }
      } else {
        const downloadedColors = new Set();
        for (const variant of variants) {
          if (product.colors.includes(variant.color) && !downloadedColors.has(variant.color)) {
            if (variant.image) {
              const ext = variant.image.split(".").pop();
              const colorSlug = variant.color.replace(/\s+/g, "-").toLowerCase();
              let baseName = product.name;
              if (baseName === "Classic T-Shirt" && colorSlug === "navy-blue") baseName = "Classic T-Shirt Navy";
              const filename = `${baseName.replace(/\s+/g, "-").toLowerCase()}-${colorSlug}.${ext}`;
              const dest = path.join(outDir, filename);
              console.log(`Downloading ${filename}...`);
              await downloadImage(variant.image, dest);
              downloadedColors.add(variant.color);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${product.name}:`, err);
    }
  }
  console.log("Finished downloading mockups!");
}

main().catch(console.error);
