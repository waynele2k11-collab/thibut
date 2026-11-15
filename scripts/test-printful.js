const https = require('https');
const token = 'Tzx6b0crTB1bT7uQZADNxPA4MWFPddk10dhD9CmN'; // from .env

function fetchProduct() {
  const options = {
    hostname: 'api.printful.com',
    path: `/products`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  };
  https.request(options, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      const products = JSON.parse(data).result;
      const totes = products.filter(p => p.title && p.title.toLowerCase().includes('tote'));
      console.log(JSON.stringify(totes.map(h => ({id: h.id, title: h.title})).slice(0, 5), null, 2));
    });
  }).end();
}
fetchProduct();
