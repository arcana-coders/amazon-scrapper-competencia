const {
  clearScreen,
  typewriteLine,
  showSeparator,
  showTitle
} = require('./utils/display-utils');

class ProgressDisplay {
  constructor() {
    this.lastUpdate = 0;
  }

  formatTime(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async mostrarDashboard(estado, config) {
    // Evitar parpadeo excesivo
    const now = Date.now();
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = now;

    clearScreen();
    
    // HEADER
    const statusIcon = estado.pausado ? '⏸️ ' : (estado.activo ? '🟢' : '⚪');
    const statusText = estado.pausado ? 'PAUSADO' : (estado.activo ? 'EN EJECUCIÓN' : 'INACTIVO');
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(` ${statusIcon} PIPELINE AUTOMÁTICO - ${statusText}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // VENDEDOR ACTUAL
    const actual = estado.cola[0];
    if (actual && estado.activo && !estado.pausado) {
      console.log(`📍 VENDEDOR ACTUAL: ${actual.vendedorId}`);
      console.log(`   └─ 🔄 Fase: ${actual.progreso.faseActual || 'Iniciando...'}`);
      
      // Calcular tiempo transcurrido si hay timestamp de inicio
      if (actual.iniciado) {
        const start = new Date(actual.iniciado).getTime();
        const elapsed = now - start;
        console.log(`   └─ ⏱️  Tiempo en proceso: ${this.formatTime(elapsed)}`);
      }

      // Progreso detallado
      if (actual.progreso.batchActual) {
        const totalB = actual.progreso.totalBatches || '?';
        console.log(`   └─ 📦 Batch: ${actual.progreso.batchActual}/${totalB}`);
      }
      if (actual.progreso.productosActual) {
         const totalP = actual.progreso.totalProductos || '?';
         console.log(`   └─ 🛍️  Productos: ${actual.progreso.productosActual}/${totalP}`);
      }
      if (actual.progreso.mensaje) {
          // Truncar mensaje si es muy largo
          let msg = actual.progreso.mensaje;
          if (msg.length > 70) msg = msg.substring(0, 67) + '...';
          console.log(`   └─ 💬 ${msg}`);
      }

      console.log('');
      
      // Fases
      console.log('   ESTADO DE FASES:');
      actual.fases.forEach(fase => {
        let icon = '⬜'; // Pendiente
        let marcador = '';

        if (actual.fasesCompletadas.includes(fase)) {
          icon = '✅';
        } else if (actual.progreso.faseActual === fase) {
          icon = '🔄';
          marcador = ' ← EJECUTANDO AHORA';
        }

        console.log(`   ${icon} ${fase}${marcador}`);
      });

    } else if (estado.pausado) {
      console.log('   ⚠️  El pipeline está pausado.');
      console.log('      Escribe [R] abajo para reanudar');
    } else {
      console.log('   💤 Esperando comandos...');
    }

    console.log('');
    console.log('───────────────────────────────────────────────────────────────────');
    
    // COLA
    console.log(`📋 COLA DE ESPERA (${Math.max(0, estado.cola.length - 1)} pendientes):`);
    if (estado.cola.length > 1) {
      estado.cola.slice(1, 4).forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.vendedorId} [${v.fases.length} fases]`);
      });
      if (estado.cola.length > 4) {
        console.log(`   ... y ${estado.cola.length - 4} más`);
      }
    } else {
      console.log('   (Cola vacía)');
    }

    // ESTADISTICAS
    console.log('');
    console.log('📊 ESTADÍSTICAS SESIÓN:');
    console.log(`   ✓ Completados: ${estado.estadisticas.vendedoresProcesados}`);
    console.log(`   ❌ Errores:    ${estado.estadisticas.vendedoresConError}`);

    console.log('');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log('💡 Ctrl+C para detener | Comandos: add <id>, pause, resume, status');
    console.log('═══════════════════════════════════════════════════════════════════');
  }
}

module.exports = new ProgressDisplay();
