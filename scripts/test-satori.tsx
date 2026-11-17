import satori from 'satori';
import fs from 'fs';
import React from 'react';

async function main() {
  const fontResponse = await fetch('https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf');
  const fontData = await fontResponse.arrayBuffer();

  const svgBase64 = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgc3Ryb2tlPSJncmVlbiIgc3Ryb2tlLXdpZHRoPSI0IiBmaWxsPSJ5ZWxsb3ciIC8+PC9zdmc+`;

  const svg = await satori(
    <div style={{ display: 'flex', width: '4500px', height: '5400px', position: 'relative' }}>
      <img src={svgBase64} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </div>,
    { width: 4500, height: 5400, fonts: [{ name: 'Roboto', data: fontData, weight: 700, style: 'normal' }] }
  );

  fs.writeFileSync('test_satori.svg', svg);
  console.log('Saved test_satori.svg');
}
main();
