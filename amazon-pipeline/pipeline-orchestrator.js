const manager = require('./modules/pipeline-manager');
const executor = require('./modules/phase-executor');
const display = require('./modules/progress-display');
const projectLoader = require('./modules/project-loader');
const config = require('./config/pipeline-config');
const logger = require('./modules/logger');

// Manejo de argumentos CLI
const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

async function main() {
  // Cargar estado
  manager.state = manager.loadState();

  // Sincronizar automáticamente al inicio si no es un comando específico de gestión
  if (command === 'start' || !command) {
    await projectLoader.syncWithPipeline();
  }

  if (!command) {
    console.log(`
🤖 Amazon Pipeline Orchestrator
------------------------------
Uso:
  node pipeline-orchestrator.js start       -> Iniciar procesamiento (Auto-sync)
  node pipeline-orchestrator.js add <ID>    -> Agregar vendedor manual
  node pipeline-orchestrator.js pause       -> Pausar pipeline
  node pipeline-orchestrator.js resume      -> Reanudar e iniciar pipeline
  node pipeline-orchestrator.js status      -> Ver estado actual
  node pipeline-orchestrator.js clear       -> Limpiar cola
    `);
    return;
  }

  switch (command) {
    case 'add':
      if (!param) {
        console.error('❌ Debes especificar un ID de vendedor.');
        process.exit(1);
      }
      try {
        await manager.agregarVendedor(param);
        logger.logCommand('add', { vendorId: param });
        console.log(`✅ Vendedor ${param} agregado a la cola.`);
      } catch (e) {
        logger.error(`Error agregando vendedor ${param}`, e);
        console.error(`❌ Error: ${e.message}`);
      }
      break;

    case 'pause':
      manager.state.pausado = true;
      manager.state.activo = false;
      await manager.saveState();
      logger.logCommand('pause');
      console.log('⏸️  Pipeline pausado.');
      break;

    case 'resume':
      manager.state.pausado = false;
      await manager.saveState();
      logger.logCommand('resume');
      console.log('▶️  Pipeline reanudado.');
      console.log('🚀 Iniciando pipeline automáticamente...\n');
      await startPipeline();
      break;

    case 'clear':
      const clearedCount = manager.state.cola.length;
      manager.state.cola = [];
      await manager.saveState();
      logger.logCommand('clear', { vendorsCleared: clearedCount });
      console.log('🗑️  Cola limpiada.');
      break;

    case 'status':
      logger.logCommand('status');
      display.mostrarDashboard(manager.state);
      break;

    case 'start':
      logger.logCommand('start');
      logger.log('Pipeline iniciado');
      await startPipeline();
      break;

    default:
      console.error('❌ Comando desconocido.');
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para esperar input del usuario con timeout
function esperarInputConTimeout(timeoutMs) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let inputRecibido = false;
    const timer = setTimeout(() => {
      if (!inputRecibido) {
        rl.close();
        resolve(null);
      }
    }, timeoutMs);

    rl.question('Opción: ', (respuesta) => {
      inputRecibido = true;
      clearTimeout(timer);
      rl.close();
      resolve(respuesta.toLowerCase().trim());
    });

    // Permitir que Ctrl+C funcione
    rl.on('SIGINT', () => {
      rl.close();
      process.exit(0);
    });
  });
}

// Validar que todos los scripts existan antes de iniciar
function validarScripts() {
  const fs = require('fs');
  const path = require('path');
  const missingScripts = [];

  console.log('🔍 Validando scripts...');

  for (const [fase, faseConfig] of Object.entries(config.scripts)) {
    const scriptRelativePath = typeof faseConfig === 'object' ? faseConfig.path : faseConfig;
    const scriptPath = path.resolve(__dirname, scriptRelativePath);

    if (!fs.existsSync(scriptPath)) {
      missingScripts.push({ fase, path: scriptPath });
      console.error(`❌ Script no encontrado para fase "${fase}": ${scriptPath}`);
    } else {
      console.log(`✓ ${fase}: ${path.basename(scriptPath)}`);
    }
  }

  if (missingScripts.length > 0) {
    console.error(`\n❌ Faltan ${missingScripts.length} scripts. No se puede iniciar el pipeline.`);
    logger.error('Validación de scripts falló', { missingScripts });
    return false;
  }

  console.log('✅ Todos los scripts están disponibles.\n');
  return true;
}

async function startPipeline() {
  // Validar scripts antes de empezar
  if (!validarScripts()) {
    process.exit(1);
  }
  console.log('🚀 Iniciando Pipeline Automático...');

  while (true) {
    if (shuttingDown) {
      console.log('🛑 Pipeline detenido por usuario.');
      break;
    }

    manager.state = manager.loadState();

    if (manager.state.pausado) {
      await display.mostrarDashboard(manager.state);

      // Ofrecer opción interactiva para reanudar
      console.log('\n👉 Opciones:');
      console.log('   [R] Reanudar pipeline');
      console.log('   [Q] Salir');
      console.log('   (Auto-refresh en 10s)\n');

      const respuesta = await esperarInputConTimeout(10000);

      if (respuesta === 'r') {
        console.log('▶️  Reanudando pipeline...');
        manager.state.pausado = false;
        await manager.saveState();
        await delay(1000);
      } else if (respuesta === 'q') {
        console.log('👋 Saliendo del pipeline...');
        process.exit(0);
      }

      continue;
    }

    const vendedor = manager.getSiguienteVendedor();

    // DEBUG
    console.log(`\n🐛 DEBUG: getSiguienteVendedor() retornó:`, vendedor ? vendedor.vendedorId : 'NULL');
    console.log(`🐛 DEBUG: Cola length:`, manager.state.cola.length);
    console.log(`🐛 DEBUG: Pausado:`, manager.state.pausado);

    if (!vendedor) {
      manager.state.activo = false;
      await manager.saveState();

      // Intentar resincronizar si la cola está vacía
      await display.mostrarDashboard(manager.state);
      // console.log('🔄 Buscando nuevos vendedores...'); // Opcional
      await projectLoader.syncWithPipeline();

      await delay(10000);
      continue;
    }

    console.log(`\n🐛 DEBUG: Iniciando procesamiento de ${vendedor.vendedorId}`);
    console.log(`🐛 DEBUG: Fases:`, vendedor.fases);
    console.log(`🐛 DEBUG: Fases completadas:`, vendedor.fasesCompletadas);

    manager.state.activo = true;
    manager.state.vendedorActual = vendedor.vendedorId;
    if (!vendedor.iniciado) {
        vendedor.iniciado = new Date().toISOString();
        logger.logVendorStart(vendedor.vendedorId, vendedor.fases);
        await manager.saveState();
    }

    let errorFatal = false;

    console.log(`\n🐛 DEBUG: Entrando en loop de fases...`);

    for (const fase of vendedor.fases) {
      console.log(`\n🐛 DEBUG: Procesando fase: ${fase}`);
      manager.state = manager.loadState();

      // Actualizar referencia al vendedor después de reload
      const vendedorActualizado = manager.state.cola.find(v => v.vendedorId === vendedor.vendedorId);
      if (!vendedorActualizado) {
        console.log(`🐛 DEBUG: Vendedor ${vendedor.vendedorId} no encontrado en cola después de reload`);
        break;
      }

      if (manager.state.pausado) break;
      if (vendedorActualizado.fasesCompletadas.includes(fase)) {
        console.log(`🐛 DEBUG: Fase ${fase} ya completada, saltando...`);
        continue;
      }

      vendedorActualizado.progreso.faseActual = fase;
      vendedorActualizado.progreso.mensaje = 'Iniciando...';
      await manager.actualizarProgreso(vendedorActualizado.vendedorId, {});

      await display.mostrarDashboard(manager.state);  // Agregado await

      console.log(`🐛 DEBUG: A punto de ejecutar fase ${fase}...`);

      let intentoActual = 0;
      let faseCompletada = false;
      const esRetryable = config.reintentos.fasesRetry.includes(fase);
      const maxIntentos = esRetryable ? config.reintentos.maxIntentos : 1;

      while (intentoActual < maxIntentos && !faseCompletada) {
        intentoActual++;

        try {
          if (intentoActual > 1) {
            console.log(`🔄 Reintento ${intentoActual}/${maxIntentos} para fase ${fase}`);
            logger.logRetry(vendedor.vendedorId, fase, intentoActual, maxIntentos);
            vendedor.progreso.mensaje = `Reintento ${intentoActual}/${maxIntentos}...`;
            await manager.actualizarProgreso(vendedor.vendedorId, {});
            display.mostrarDashboard(manager.state);
          } else {
            logger.logPhase(vendedor.vendedorId, fase, 'Iniciando fase');
          }

          await executor.ejecutarFase(fase, vendedor.vendedorId, {
            onProgress: (data) => {
              manager.actualizarProgreso(vendedor.vendedorId, data);
              // NO refrescar dashboard aquí - se llama demasiado frecuentemente
            },
            onLog: (msg) => {
               manager.actualizarProgreso(vendedor.vendedorId, { mensaje: msg });
            }
          });

          await manager.marcarFaseCompletada(vendedor.vendedorId, fase);
          logger.logPhaseComplete(vendedor.vendedorId, fase);
          faseCompletada = true;

          vendedor.progreso.mensaje = `Esperando ${config.delays.entreFases / 1000}s...`;
          await manager.actualizarProgreso(vendedor.vendedorId, {});
          display.mostrarDashboard(manager.state);
          await delay(config.delays.entreFases);

        } catch (error) {
          console.error(`❌ Error en fase ${fase} (intento ${intentoActual}/${maxIntentos}):`, error.message);
          logger.errorVendor(vendedor.vendedorId, `Error en fase ${fase} (intento ${intentoActual}/${maxIntentos})`, error);

          // Verificar si es un error crítico (detener pipeline completo)
          const esCritico = config.erroresCriticos.some(err => error.message.includes(err));

          // Verificar si es un error que NO vale la pena reintentar (saltar vendedor)
          const esNoRetry = config.erroresNoRetry && config.erroresNoRetry.some(err =>
            error.message.toLowerCase().includes(err.toLowerCase())
          );

          if (esCritico || esNoRetry || intentoActual >= maxIntentos) {
            // Error fatal, no-retry, o se agotaron los reintentos
            errorFatal = true;
            const razon = esCritico ? 'Error crítico' : (esNoRetry ? 'Error no recuperable' : `${intentoActual} intentos`);
            const errorMsg = `${error.message} (${razon})`;
            await manager.moverAHistorial(vendedor.vendedorId, 'error', errorMsg);
            logger.logVendorComplete(vendedor.vendedorId, 'error', errorMsg);

            if (esNoRetry) {
              console.log(`⏭️  Saltando vendedor (error no recuperable)`);
            }
            break;
          } else {
            // Esperar antes de reintentar
            console.log(`⏳ Esperando ${config.delays.entreReintentos / 1000}s antes de reintentar...`);
            logger.logPhase(vendedor.vendedorId, fase, `Esperando ${config.delays.entreReintentos / 1000}s antes de reintentar`);
            vendedor.progreso.mensaje = `Esperando para reintentar...`;
            await manager.actualizarProgreso(vendedor.vendedorId, {});
            display.mostrarDashboard(manager.state);
            await delay(config.delays.entreReintentos);
          }
        }
      }

      if (errorFatal) break;
    }

    if (manager.state.pausado) continue;

    if (!errorFatal) {
      const todasCompletas = vendedor.fases.every(f => vendedor.fasesCompletadas.includes(f));
      if (todasCompletas) {
        await manager.moverAHistorial(vendedor.vendedorId, 'completado');
        logger.logVendorComplete(vendedor.vendedorId, 'completado');

        manager.state.vendedorActual = null;
        await manager.saveState();

        console.log(`⏳ Esperando ${config.delays.entreVendedores / 1000}s para el siguiente vendedor...`);
        await delay(config.delays.entreVendedores);
      }
    }
  }
}

// Graceful shutdown
let shuttingDown = false;

process.on('SIGINT', async () => {
  if (shuttingDown) {
    console.log('\n⚠️  Forzando salida...');
    process.exit(1);
  }

  console.log('\n🛑 Deteniendo pipeline...');
  shuttingDown = true;

  // Pausar el pipeline
  manager.state.pausado = true;
  manager.state.activo = false;
  await manager.saveState();

  console.log('✅ Estado guardado. Pipeline pausado.');
  console.log('💡 Para reanudar: node pipeline-orchestrator.js resume && node pipeline-orchestrator.js start');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recibida señal de terminación...');
  shuttingDown = true;

  manager.state.pausado = true;
  manager.state.activo = false;
  await manager.saveState();

  console.log('✅ Pipeline detenido correctamente.');
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}