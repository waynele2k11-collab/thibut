require('dotenv').config();
const fetch = require('node-fetch');
async function run() {
  const token = process.env.PRINTFUL_ACCESS_TOKEN || process.env.PRINTFUL_API_KEY;
  const res = await fetch('https://api.printful.com/mockup-generator/create-task/71', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      variant_ids: [4011],
      format: "jpg",
      files: [
        {
          placement: "front",
          image_url: "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png",
          position: { area_width: 100, area_height: 100, width: 1, height: 1, top: 0, left: 0 }
        }
      ]
    })
  });
  console.log(await res.text());
}
run();
