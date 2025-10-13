#!/usr/bin/env node
/**
 * Script de prueba para validar el flujo de solicitud de plantilla
 * Simula la interacción del usuario con el panel
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  🧪 PRUEBA: Solicitud de Plantilla desde Panel            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📋 Pasos de la prueba:');
console.log('   1. Abrir panel interactivo');
console.log('   2. Seleccionar opción [5] - Publicar oportunidades');
console.log('   3. Seleccionar opción [1] - Solicitar plantilla');
console.log('   4. Elegir vendedor A3Q5ASRA7J8Y5E');
console.log('   5. Elegir archivo opción 1 (oportunidades.csv)');
console.log('');
console.log('⚠️  NOTA: Esta es una prueba manual interactiva');
console.log('   Necesitas interactuar con el panel manualmente.');
console.log('');
console.log('🚀 Iniciando panel...');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Establecer modo rápido para que no haya animaciones
process.env.FAST_PANEL = '1';

const panel = spawn('node', ['buscadordeoportunidades.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

panel.on('close', (code) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Panel cerrado con código: ${code}`);
  console.log('');
  
  if (code === 0) {
    console.log('✅ Prueba completada');
  } else {
    console.log('⚠️  Panel cerrado con error o cancelación');
  }
});

panel.on('error', (err) => {
  console.error('❌ Error al ejecutar el panel:', err.message);
});
