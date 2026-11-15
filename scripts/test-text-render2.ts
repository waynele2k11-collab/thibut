import { generatePrintMaster } from '../src/lib/print-generator';
import { DesignComposition } from '../src/lib/print/types';
import { generateInstantSvgString } from '../src/lib/calligraphy/ClientCalligraphyRenderer';
import fs from 'fs';

async function main() {
  const svgContent = generateInstantSvgString({
    text: "決して諦めない",
    tradition: "JAPANESE_SHODO",
    strokePreset: "BOLD_BRUSH",
    variationType: "01_CONTROLLED",
    hasSeal: false
  });

  const b64 = Buffer.from(svgContent).toString('base64');

  const comp: DesignComposition = {
    canvas: { width: 4500, height: 5400, dpi: 300 },
    layers: [
      {
        id: '1', type: 'vector', zIndex: 2, opacity: 1, blendMode: 'normal',
        svgBase64: `data:image/svg+xml;base64,${b64}`,
        transform: { x: 0, y: 0, scale: 2, rotation: 0 },
        colorHex: '#000000'
      }
    ]
  };

  const buffer = await generatePrintMaster(comp);
  fs.writeFileSync('test_text_render_no_seal.png', buffer);
  console.log('Saved test_text_render_no_seal.png - Size:', buffer.length);
}

main().catch(console.error);
