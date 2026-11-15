import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('test_text_render_no_seal.png');
const png = PNG.sync.read(data);

let hasNonTransparent = false;
let colorPixels = 0;
for (let i = 0; i < png.data.length; i += 4) {
  if (png.data[i + 3] > 0) {
    hasNonTransparent = true;
    colorPixels++;
  }
}
console.log('Total pixels:', png.width * png.height);
console.log('Non-transparent pixels:', colorPixels);
