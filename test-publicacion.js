#!/usr/bin/env node
/**
 * Script de prueba para verificar la detección de archivos de oportunidades
 * y el sistema de registro de publicaciones.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PROJECTS_FILE = path.join(ROOT_DIR, 'data', 'projects.json');
const VENDORS_DIR = path.join(ROOT_DIR, 'data', 'vendors');

function detectVendorsWithOpportunities() {
  if (!fs.existsSync(VENDORS_DIR)) {
    return [];
  }

  const vendors = [];
  const sellers = fs.readdirSync(VENDORS_DIR);

  for (const sellerId of sellers) {
    const vendorDir = path.join(VENDORS_DIR, sellerId);
    const stat = fs.statSync(vendorDir);
    
    if (!stat.isDirectory()) {
      continue;
    }

    const files = {
      oportunidades: path.join(vendorDir, 'oportunidades.csv'),
      menos_50: path.join(vendorDir, 'oportunidades_menos_50.csv'),
      menos_100: path.join(vendorDir, 'oportunidades_menos_100.csv')
    };

    const available = {};
    let hasAny = false;

    if (fs.existsSync(files.oportunidades)) {
      const size = fs.statSync(files.oportunidades).size;
      available.oportunidades = { exists: true, size };
      hasAny = true;
    }
    if (fs.existsSync(files.menos_50)) {
      const size = fs.statSync(files.menos_50).size;
      available.menos_50 = { exists: true, size };
      hasAny = true;
    }
    if (fs.existsSync(files.menos_100)) {
      const size = fs.statSync(files.menos_100).size;
      available.menos_100 = { exists: true, size };
      hasAny = true;
    }

    if (hasAny) {
      vendors.push({
        sellerId,
        files: available
      });
    }
  }

  return vendors;
}

function getPublicationStatus(sellerId) {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return null;
  }

  const projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  const project = projectsData.projects?.[sellerId];
  
  if (!project || !project.publication_requests) {
    return null;
  }

  return project.publication_requests;
}

console.log('🔍 Verificando sistema de detección de oportunidades...\n');

const vendors = detectVendorsWithOpportunities();

if (vendors.length === 0) {
  console.log('❌ No se encontraron vendedores con archivos de oportunidades.');
  process.exit(1);
}

console.log(`✅ Encontrados ${vendors.length} vendedor(es) con archivos de oportunidades:\n`);

for (const vendor of vendors) {
  console.log(`📦 Vendedor: ${vendor.sellerId}`);
  console.log('   Archivos disponibles:');
  
  if (vendor.files.oportunidades) {
    console.log(`   ✓ oportunidades.csv (${vendor.files.oportunidades.size} bytes)`);
  }
  if (vendor.files.menos_50) {
    console.log(`   ✓ oportunidades_menos_50.csv (${vendor.files.menos_50.size} bytes)`);
  }
  if (vendor.files.menos_100) {
    console.log(`   ✓ oportunidades_menos_100.csv (${vendor.files.menos_100.size} bytes)`);
  }

  // Verificar estado de publicaciones
  const status = getPublicationStatus(vendor.sellerId);
  if (status) {
    console.log('\n   📋 Solicitudes previas:');
    if (status.oportunidades) {
      const date = new Date(status.oportunidades.requested_at);
      console.log(`   ✓ oportunidades.csv - ${date.toLocaleString()}`);
    }
    if (status.menos_50) {
      const date = new Date(status.menos_50.requested_at);
      console.log(`   ✓ oportunidades_menos_50.csv - ${date.toLocaleString()}`);
    }
    if (status.menos_100) {
      const date = new Date(status.menos_100.requested_at);
      console.log(`   ✓ oportunidades_menos_100.csv - ${date.toLocaleString()}`);
    }
  } else {
    console.log('\n   ℹ️  Sin solicitudes previas registradas');
  }
  
  console.log('');
}

console.log('✅ Sistema de detección funcionando correctamente\n');
