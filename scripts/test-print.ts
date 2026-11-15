import { generatePrintMaster } from '../src/lib/print-generator';
import { DesignComposition } from '../src/lib/print/types';
import fs from 'fs';

async function main() {
  const comp: DesignComposition = {
    canvas: {
      width: 4500,
      height: 5400,
      dpi: 300,
      backgroundColor: '#f6f1e7'
    },
    layers: [
      {
        id: '1',
        type: 'vector',
        zIndex: 2,
        opacity: 1,
        blendMode: 'normal',
        svgBase64: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgc3Ryb2tlPSJncmVlbiIgc3Ryb2tlLXdpZHRoPSI0IiBmaWxsPSJ5ZWxsb3ciIC8+PC9zdmc+`, // Just a yellow circle
        transform: {
          x: 0,
          y: -1000,
          scale: 5,
          rotation: 45
        },
        colorHex: '#000000'
      }
    ]
  };

  const buffer = await generatePrintMaster(comp);
  fs.writeFileSync('test_print.png', buffer);
  console.log('Saved test_print.png');
}

main().catch(console.error);
