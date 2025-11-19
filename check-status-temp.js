const fs = require('fs');
const path = require('path');

const file = path.join('data', 'vendors', 'A1HGYOYPGEKVQ5', 'all-products-consolidated.json');

try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const products = data.all_products || [];

  const pendingMX = products.filter(p => !p.fecha_verificacion_mx || !p.precio_actual_mx).length;
  const verifiedMX = products.filter(p => p.fecha_verificacion_mx && p.precio_actual_mx).length;
  const pendingUSA = products.filter(p => !p.fecha_verificacion_usa || !p.precio_actual_usd).length;

  console.log('Total productos:', products.length);
  console.log('Verificados MX:', verifiedMX);
  console.log('Pendientes MX:', pendingMX);
  console.log('Pendientes USA:', pendingUSA);
} catch(e) {
  console.log('Error:', e.message);
}
