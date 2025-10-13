#!/usr/bin/env node
/**
 * Script para descargar la plantilla generada de Amazon Seller Central
 * Descarga la plantilla más reciente y la guarda en la carpeta del vendedor
 * 
 * IMPORTANTE: Debe pasar al menos 30 minutos después de solicitar la plantilla
 * 
 * Uso: node descargar-plantilla-seller.js SELLER_ID
 * Ejemplo: node descargar-plantilla-seller.js A3Q5ASRA7J8Y5E
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dayjs = require('dayjs');

// 🧠 Validar argumentos
const sellerId = process.argv[2];

if (!sellerId) {
  console.error('❌ Error: Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node descargar-plantilla-seller.js SELLER_ID');
  console.error('Ejemplo: node descargar-plantilla-seller.js A3Q5ASRA7J8Y5E');
  console.error('');
  console.error('⚠️  IMPORTANTE: Debes esperar al menos 30 minutos después de solicitar la plantilla');
  process.exit(1);
}

// 📁 Rutas
const ROOT_DIR = __dirname;
const cookiePath = path.join(ROOT_DIR, 'scripts', 'auth', 'amazonseller.json');
const vendorDir = path.join(ROOT_DIR, 'data', 'vendors', sellerId);
const downloadDir = path.join(vendorDir, 'plantillas');

// Verificar que exista la carpeta del vendedor
if (!fs.existsSync(vendorDir)) {
  console.error(`❌ Error: No existe la carpeta del vendedor: ${vendorDir}`);
  console.error('   Asegúrate de que el SELLER_ID sea correcto.');
  process.exit(1);
}

// Crear carpeta de plantillas si no existe
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
  console.log(`📁 Carpeta de plantillas creada: ${downloadDir}`);
}

// Verificar cookies
if (!fs.existsSync(cookiePath)) {
  console.error(`❌ Error: No se encontraron las cookies de Amazon Seller Central`);
  console.error(`   Ruta esperada: ${cookiePath}`);
  console.error('   Ejecuta el script de login primero.');
  process.exit(1);
}

(async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📥 DESCARGA DE PLANTILLA - Amazon Seller Central          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📦 Vendedor: ${sellerId}`);
  console.log(`📁 Destino: ${downloadDir}`);
  console.log('');
  console.log('⏳ Conectando con Amazon Seller Central...');
  
  const browser = await chromium.launch({ 
    headless: false // Cambia a true si no quieres ver el navegador
  });
  
  const context = await browser.newContext({
    storageState: cookiePath,
    acceptDownloads: true
  });

  const page = await context.newPage();
  
  try {
    await page.goto('https://sellercentral.amazon.com/product-search/bulk/generate/history', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('⌛ Buscando historial de plantillas...');
    
    try {
      await page.waitForSelector('table tbody tr', { timeout: 30000 });
    } catch (err) {
      console.error('');
      console.error('❌ No se encontró la tabla de historial de plantillas.');
      console.error('   Posibles causas:');
      console.error('   - Las cookies expiraron (ejecuta el script de login)');
      console.error('   - No tienes acceso a esta sección de Seller Central');
      console.error('   - La página cambió su estructura');
      await browser.close();
      process.exit(1);
    }

    // Obtener la primera fila (más reciente)
    const fila = await page.$('table tbody tr');
    if (!fila) {
      console.error('');
      console.error('❌ No se encontraron plantillas en el historial.');
      console.error('   Asegúrate de haber solicitado una plantilla primero.');
      await browser.close();
      process.exit(1);
    }

    // Extraer información de la fila
    const filaTexto = await fila.textContent();
    console.log('');
    console.log('📋 Plantilla más reciente encontrada:');
    console.log(`   ${filaTexto.trim().substring(0, 100)}...`);
    console.log('');

    // Buscar el botón de descarga
    const boton = await fila.$('button:has-text("Descargar")');
    if (!boton) {
      console.log('⏳ La plantilla aún no está lista para descarga.');
      console.log('');
      console.log('⚠️  IMPORTANTE: Amazon tarda aproximadamente 30 minutos en generar la plantilla.');
      console.log('   Vuelve a intentar más tarde.');
      console.log('');
      await browser.close();
      process.exit(0);
    }

    console.log('✅ Plantilla lista para descarga');
    console.log('🖱  Descargando archivo...');
    
    let download;
    try {
      [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        boton.click()
      ]);
    } catch (error) {
      console.error('');
      console.error('❌ Error al intentar descargar el archivo.');
      console.error(`   ${error.message}`);
      await browser.close();
      process.exit(1);
    }

    // Generar nombre del archivo con fecha
    const fecha = dayjs().format('YYYY-MM-DD_HH-mm');
    const nombreArchivo = `plantilla_${sellerId}_${fecha}.xlsm`;
    const destino = path.join(downloadDir, nombreArchivo);

    await download.saveAs(destino);
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PLANTILLA DESCARGADA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📄 Archivo: ${nombreArchivo}`);
    console.log(`📁 Ubicación: ${destino}`);
    console.log(`📦 Vendedor: ${sellerId}`);
    console.log('');
    console.log('⏭️  Siguiente paso: Llenar la plantilla con precios');
    console.log('   node llenar-plantilla-seller.js ' + sellerId);
    console.log('');

    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Error inesperado:');
    console.error(`   ${error.message}`);
    console.error('');
    await browser.close();
    process.exit(1);
  }
})();
