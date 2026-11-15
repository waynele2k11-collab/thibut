import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';
import { DesignComposition } from './print/types';

/**
 * Generates a high-res print master file from a Universal Composition Object.
 * This is meant to be run inside a Server Action or Background Worker.
 */
export async function generatePrintMaster(composition: DesignComposition): Promise<Buffer> {
  let fontData: ArrayBuffer;
  try {
    const fontResponse = await fetch('https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf');
    fontData = await fontResponse.arrayBuffer();
  } catch (e) {
    throw new Error('Failed to load font data for Satori rendering.');
  }

  // Sort layers by zIndex so they render in correct order
  const sortedLayers = [...composition.layers].sort((a, b) => a.zIndex - b.zIndex);

  const svg = await satori(
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: composition.canvas.backgroundColor || 'transparent',
      }}
    >
      {sortedLayers.map((layer) => {
        if (layer.type === 'media') {
          return (
            <img
              key={layer.id}
              src={layer.assetUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: layer.fillMode,
                opacity: layer.opacity,
              }}
            />
          );
        } else if (layer.type === 'vector') {
          // Calculate transforms based on the canvas center
          // Note: Satori handles basic transforms: translate, scale, rotate
          const transform = `translate(${layer.transform.x}px, ${layer.transform.y}px) scale(${layer.transform.scale}) rotate(${layer.transform.rotation}deg)`;
          
          return (
            <div
              key={layer.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: layer.opacity,
              }}
            >
              <img
                src={layer.svgBase64}
                style={{
                  transform,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          );
        }
        return null;
      })}
    </div>,
    {
      width: composition.canvas.width,
      height: composition.canvas.height,
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

  const resvg = new Resvg(svg, {
    background: composition.canvas.backgroundColor || 'rgba(0, 0, 0, 0)',
    fitTo: {
      mode: 'original',
    },
  });

  return resvg.render().asPng();
}
