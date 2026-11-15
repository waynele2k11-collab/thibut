import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DOWNLOADS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads');
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');
const TEMP_DIR = path.join(process.cwd(), 'scripts', 'temp_extract');

async function main() {
  console.log(`Searching for font archives in ${DOWNLOADS_DIR}...`);

  // Ensure directories exist
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Find target archives
  const files = fs.readdirSync(DOWNLOADS_DIR);
  const archives = files.filter(f => 
    (f.endsWith('.zip') || f.endsWith('.rar')) && 
    (f.toLowerCase().includes('font') || f.toLowerCase().includes('thư pháp') || f.toLowerCase().includes('thu phap'))
  );

  if (archives.length === 0) {
    console.log('No font archives found in Downloads.');
    return;
  }

  let i = 0;
  for (const archive of archives) {
    i++;
    const archivePath = path.join(DOWNLOADS_DIR, archive);
    const extractPath = path.join(TEMP_DIR, `archive_${i}`);
    
    console.log(`\nExtracting ${archive}...`);
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    try {
      // unar extracts to the current directory by default, so we specify the output directory
      execSync(`unar -f -o "${extractPath}" "${archivePath}"`, { stdio: 'ignore' });
    } catch (e) {
      console.error(`Error extracting ${archive}:`, e.message);
      continue;
    }

    // Find and process fonts
    const processDir = async (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          await processDir(fullPath);
        } else if (item.toLowerCase().endsWith('.ttf') || item.toLowerCase().endsWith('.otf')) {
          // Clean filename: remove spaces, special chars, keep alphanumeric and hyphens
          const cleanName = item.replace(/[^a-zA-Z0-9.\-]/g, '_');
          const destPath = path.join(FONTS_DIR, cleanName);
          
          fs.copyFileSync(fullPath, destPath);
          
          const fontName = item.replace(/\.(ttf|otf)$/i, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
          const format = item.toLowerCase().endsWith('.ttf') ? 'ttf' : 'otf';
          
          // Upsert to DB
          await prisma.font.upsert({
            where: { fileName: cleanName },
            update: {},
            create: {
              name: fontName || cleanName,
              fileName: cleanName,
              format: format,
              tradition: "VIETNAMESE_THU_PHAP",
              enabled: true
            }
          });
          
          console.log(`Imported: ${cleanName}`);
        }
      }
    };

    await processDir(extractPath);
  }

  // Cleanup
  console.log('\nCleaning up temporary files...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
