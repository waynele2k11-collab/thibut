import { generateInstantSvgString } from '../src/lib/calligraphy/ClientCalligraphyRenderer';

const svg = generateInstantSvgString({
  text: "Có Chí Thì Nên",
  tradition: "VIETNAMESE_THU_PHAP",
  strokePreset: "BOLD_BRUSH",
  variationType: "01_CONTROLLED",
  layout: "VERTICAL"
});
console.log(svg);
