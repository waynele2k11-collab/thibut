"use client";

import React, { useState } from 'react';
import { CanvasPreview } from './CanvasPreview';
import { ControlsDrawer } from './ControlsDrawer';
import { StickyCTA } from './StickyCTA';

export function PersonalizationLab() {
  const [activeTab, setActiveTab] = useState<'NAME' | 'QUOTE' | 'STORY'>('NAME');
  const [inputText, setInputText] = useState('');
  const [interpretation, setInterpretation] = useState('Literal');
  const [stylePack, setStylePack] = useState('Classic');
  const [composition, setComposition] = useState('Centered');

  const licensePrice = 4.99;
  const personalizationPrice = 2.00;
  const blankPrice = 25.00;

  return (
    <div className="w-full bg-background min-h-screen relative font-body-md text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-12">

        {/* Header + Breadcrumb */}
        <header className="mb-8 border-b border-surface-variant pb-6">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-label-caps mb-4">
            <span>Input</span>
            <span>›</span>
            <span className="text-primary font-bold">Interpretation</span>
            <span>›</span>
            <span>Style Selection</span>
          </div>
          <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-primary mb-2">Personalization Studio</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Customize your selected artwork. Adjust the meaning, layout, and style.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Side: Canvas Preview */}
          <div className="lg:col-span-7">
            <div className="sticky top-24">
              <CanvasPreview
                inputText={inputText}
                interpretation={interpretation}
                stylePack={stylePack}
              />
            </div>
          </div>

          {/* Right Side: Controls Drawer */}
          <div className="lg:col-span-5">
            <ControlsDrawer
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              inputText={inputText}
              setInputText={setInputText}
              interpretation={interpretation}
              setInterpretation={setInterpretation}
              stylePack={stylePack}
              setStylePack={setStylePack}
              composition={composition}
              setComposition={setComposition}
            />
          </div>
        </div>
      </div>

      <StickyCTA
        licensePrice={licensePrice}
        personalizationPrice={personalizationPrice}
        blankPrice={blankPrice}
      />
    </div>
  );
}
