import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * Generates a 4500x5400 px @ 300 DPI transparent PNG print master file.
 * This is meant to be run inside a Server Action or Background Worker.
 */
export async function generatePrintMaster(text: string, stylePack: string): Promise<Buffer> {
  let fontData: ArrayBuffer;
  try {
    // In production, load from a local asset or cache to speed up.
    // We fetch a standard font here as a fallback for the Canvas drawing.
    const fontResponse = await fetch('https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf');
    fontData = await fontResponse.arrayBuffer();
  } catch (e) {
    throw new Error('Failed to load font data for Satori rendering.');
  }

  // Satori converts React elements to an SVG string.
  // 4500x5400 is the standard DTG print file size.
  const svg = await satori(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: 'black',
        fontSize: '400px',
        fontWeight: 'bold',
        fontFamily: 'Roboto',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '80%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {text}
      </div>
      <div style={{ 
        fontSize: '150px', 
        marginTop: '100px', 
        color: '#B3261E', // Vermilion Seal Accent
        border: '10px solid #B3261E',
        padding: '20px 60px',
        display: 'flex'
      }}>
        {stylePack}
      </div>
    </div>,
    {
      width: 4500,
      height: 5400,
      fonts: [
        {
          name: 'Roboto',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  // Resvg converts the SVG string to a high-res PNG Buffer
  const resvg = new Resvg(svg, {
    background: 'rgba(0, 0, 0, 0)', // Transparent background for apparel printing
    fitTo: {
      mode: 'original',
    },
  });

  return resvg.render().asPng();
}
