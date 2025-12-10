const fs = require('fs');
const path = require('path');

const batchFile = 'C:/robots/amazon-scrapper-otherseller/data/vendors/AE8MUNDUREHX7/batch-1-consolidated.json';
const data = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const products = Array.isArray(data) ? data : data.all_products;

// Lógica de pendientes (igual que phase-executor.js)
const esPendienteUSA = (producto) => {
  const fecha = producto.fecha_verificacion_usa;
  if (!fecha) return true;

  const disponibilidad = (producto.disponibilidad_usa || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!producto.precio_actual_usd && !producto.vendedor_actual_usa) && !producto.error_verificacion_usa;

  return requiereDatos && missingCriticos;
};

const pendientes = products.filter(esPendienteUSA);

console.log('Total productos:', products.length);
console.log('Pendientes:', pendientes.length);
console.log('\n=== PRIMEROS 3 PENDIENTES ===\n');

pendientes.slice(0, 3).forEach((p, i) => {
  console.log(`${i + 1}. ASIN: ${p.asin}`);
  console.log(`   Título: ${p.titulo ? p.titulo.substring(0, 60) : 'N/A'}`);
  console.log(`   Disponibilidad USA: "${p.disponibilidad_usa || 'N/A'}"`);
  console.log(`   Precio USD: ${p.precio_actual_usd || 'N/A'}`);
  console.log(`   Vendedor USA: ${p.vendedor_actual_usa || 'N/A'}`);
  console.log(`   Error USA: ${p.error_verificacion_usa || 'N/A'}`);
  console.log(`   Fecha verificación: ${p.fecha_verificacion_usa || 'N/A'}`);
  console.log('');
});

// Ver si todos tienen la misma característica
const conFecha = pendientes.filter(p => p.fecha_verificacion_usa).length;
const sinFecha = pendientes.filter(p => !p.fecha_verificacion_usa).length;

console.log(`\n=== ANÁLISIS ===`);
console.log(`Con fecha_verificacion_usa: ${conFecha}`);
console.log(`Sin fecha_verificacion_usa: ${sinFecha}`);
