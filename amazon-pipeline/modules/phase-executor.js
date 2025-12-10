const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config/pipeline-config');

class PhaseExecutor {
  constructor() {
    this.currentProcess = null;
  }

  /**
   * Ejecuta una fase del pipeline
   */
  async ejecutarFase(fase, vendedorId, callbacks = {}) {
    // Fases de verificación requieren loop hasta completar (como MENU)
    const fasesConLoop = ['verificar_mx', 'verificar_usa'];
    // Fase de oportunidades usa consolidación completa (MENU Opción [3])
    const fasesConIteracion = [];

    if (fasesConLoop.includes(fase)) {
      return await this.ejecutarFaseConLoop(fase, vendedorId, callbacks);
    }

    if (fasesConIteracion.includes(fase)) {
      return await this.ejecutarFaseConIteracion(fase, vendedorId, callbacks);
    }

    // Otras fases se ejecutan una sola vez
    return await this.ejecutarScript(fase, vendedorId, callbacks);
  }

  /**
   * Ejecuta un script una sola vez
   */
  async ejecutarScript(fase, vendedorId, callbacks = {}, customArgs = null) {
    return new Promise((resolve, reject) => {
      const faseConfig = config.scripts[fase];
      if (!faseConfig) {
        return reject(new Error(`Fase '${fase}' no configurada en pipeline-config.js`));
      }

      // Soportar formato objeto { path, args } o string directo
      const scriptRelativePath = typeof faseConfig === 'object' ? faseConfig.path : faseConfig;
      const extraArgs = customArgs || (typeof faseConfig === 'object' ? (faseConfig.args || []) : []);

      // Resolver ruta absoluta
      const scriptPath = path.resolve(__dirname, '..', scriptRelativePath);

      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Script no encontrado: ${scriptPath}`));
      }

      // Construir argumentos: [script, vendedorId, ...extraArgs]
      const args = [scriptPath, vendedorId, ...extraArgs];

      console.log(`🐛 DEBUG ejecutarScript: Ejecutando ${path.basename(scriptPath)} con args:`, args);
      if (callbacks.onLog) callbacks.onLog(`🚀 Ejecutando: node ${path.basename(scriptPath)} ${vendedorId} ${extraArgs.join(' ')}`);

      this.currentProcess = spawn('node', args, {
        stdio: ['inherit', 'pipe', 'pipe'], // stdin: inherit, stdout/stderr: pipe para capturar
        shell: false,
        windowsHide: false,
        env: { ...process.env, FORCE_COLOR: 'true' }
      });

      let stderrBuffer = '';
      let stdoutBuffer = '';
      let processCompleted = false;

      // Timeout de 10 minutos para evitar que se cuelgue indefinidamente
      const timeout = setTimeout(() => {
        if (!processCompleted && this.currentProcess) {
          console.log(`🐛 DEBUG ejecutarScript: TIMEOUT alcanzado (10 min) - matando proceso`);
          if (callbacks.onLog) callbacks.onLog(`⏱️ Timeout alcanzado (10 min) - finalizando script...`);
          this.currentProcess.kill('SIGTERM');

          // Si no muere con SIGTERM, usar SIGKILL después de 5 segundos
          setTimeout(() => {
            if (this.currentProcess && !processCompleted) {
              console.log(`🐛 DEBUG ejecutarScript: Usando SIGKILL`);
              this.currentProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      }, 600000); // 10 minutos

      this.currentProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdoutBuffer += text;

        // Mostrar output en tiempo real (como MENU)
        process.stdout.write(text);

        // También analizar para callbacks de progreso
        this.analizarSalida(text, fase, callbacks);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderrBuffer += text;

        // Mostrar stderr en tiempo real (como MENU)
        process.stderr.write(text);
      });

      this.currentProcess.on('close', (code) => {
        processCompleted = true;
        clearTimeout(timeout);
        this.currentProcess = null;

        console.log(`🐛 DEBUG ejecutarScript: Proceso terminado con código ${code}`);

        if (code === 0) {
          if (callbacks.onLog) callbacks.onLog(`✅ Fase ${fase} completada.`);
          resolve();
        } else {
          const errorMsg = `❌ Fase ${fase} falló (código ${code}).`;
          if (callbacks.onLog) callbacks.onLog(errorMsg);
          // Si hay stderr, lo agregamos al error
          if (stderrBuffer) {
              // Limitar longitud de stderr
              const tail = stderrBuffer.slice(-500);
              reject(new Error(`${errorMsg}\nDetalles: ${tail}`));
          } else {
              reject(new Error(errorMsg));
          }
        }
      });

      this.currentProcess.on('error', (err) => {
        processCompleted = true;
        clearTimeout(timeout);
        this.currentProcess = null;
        console.log(`🐛 DEBUG ejecutarScript: Error en proceso:`, err.message);
        reject(err);
      });
    });
  }

  /**
   * Ejecuta fase de verificación con loop hasta completar (igual que MENU)
   */
  async ejecutarFaseConLoop(fase, vendedorId, callbacks = {}) {
    console.log(`\n🐛 DEBUG ejecutarFaseConLoop: INICIO - fase=${fase}, vendedorId=${vendedorId}`);

    const faseConfig = config.scripts[fase];
    console.log(`🐛 DEBUG ejecutarFaseConLoop: faseConfig=`, faseConfig);

    const scriptRelativePath = typeof faseConfig === 'object' ? faseConfig.path : faseConfig;
    const extraArgs = typeof faseConfig === 'object' ? (faseConfig.args || []) : [];
    console.log(`🐛 DEBUG ejecutarFaseConLoop: scriptPath=${scriptRelativePath}, extraArgs=`, extraArgs);

    // Determinar qué tipo de verificación
    const marketplace = fase === 'verificar_mx' ? 'mx' : 'usa';
    console.log(`🐛 DEBUG ejecutarFaseConLoop: marketplace=${marketplace}`);

    if (callbacks.onLog) callbacks.onLog(`🔄 Iniciando verificación ${marketplace.toUpperCase()} con loop automático...`);

    // Verificar si hay batches
    const vendorDir = path.join(__dirname, '..', '..', 'data', 'vendors', vendedorId);
    console.log(`🐛 DEBUG ejecutarFaseConLoop: vendorDir=${vendorDir}`);

    const batches = this.getBatchesConsolidados(vendorDir);
    console.log(`🐛 DEBUG ejecutarFaseConLoop: batches encontrados=`, batches);

    if (batches.length === 0) {
      throw new Error(`No se encontraron batches consolidados para ${vendedorId}`);
    }

    // Procesar cada batch con loop hasta completar (como MENU)
    console.log(`🐛 DEBUG ejecutarFaseConLoop: Iniciando loop de batches, total=${batches.length}`);

    for (const batchNum of batches) {
      console.log(`\n🐛 DEBUG ejecutarFaseConLoop: Procesando batch ${batchNum}`);
      if (callbacks.onLog) callbacks.onLog(`\n📦 Procesando batch ${batchNum}...`);

      let ronda = 1;
      let continuar = true;
      const MAX_RONDAS = 100; // Límite máximo de reintentos para evitar loops infinitos
      let ultimoPendientes = -1;
      let rondasSinCambio = 0;

      while (continuar && ronda <= MAX_RONDAS) {
        console.log(`🐛 DEBUG ejecutarFaseConLoop: Ronda ${ronda}/${MAX_RONDAS} - Batch ${batchNum}`);
        if (callbacks.onLog) callbacks.onLog(`🔄 Ronda ${ronda} - Batch ${batchNum}...`);

        // Ejecutar script con batch específico (NO 'all')
        const batchArgs = [batchNum.toString(), extraArgs[1] || '20']; // [batchNum, lote]
        console.log(`🐛 DEBUG ejecutarFaseConLoop: batchArgs=`, batchArgs);

        try {
          console.log(`🐛 DEBUG ejecutarFaseConLoop: Antes de ejecutarScript`);
          await this.ejecutarScript(fase, vendedorId, callbacks, batchArgs);
          console.log(`🐛 DEBUG ejecutarFaseConLoop: Después de ejecutarScript (éxito)`);

          // Esperar a que se guarde el archivo
          console.log(`🐛 DEBUG ejecutarFaseConLoop: Esperando 2s para que se guarde archivo...`);
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Verificar si quedan pendientes
          console.log(`🐛 DEBUG ejecutarFaseConLoop: Verificando pendientes...`);
          const pendientes = this.verificarPendientes(vendorDir, batchNum, marketplace);
          console.log(`🐛 DEBUG ejecutarFaseConLoop: pendientes=${pendientes}`);

          // Detectar si estamos en loop sin progreso
          if (pendientes === ultimoPendientes && pendientes > 0) {
            rondasSinCambio++;
            console.log(`⚠️  DEBUG: ${rondasSinCambio} rondas consecutivas con ${pendientes} pendientes sin cambio`);

            if (rondasSinCambio >= 10) {
              if (callbacks.onLog) callbacks.onLog(`⚠️  ADVERTENCIA: ${pendientes} productos no se pudieron verificar después de 10 intentos consecutivos. Continuando...`);
              console.log(`🐛 DEBUG ejecutarFaseConLoop: Loop detectado, saltando batch ${batchNum}`);
              continuar = false;
            }
          } else {
            rondasSinCambio = 0; // Resetear contador si hubo progreso
          }

          ultimoPendientes = pendientes;

          if (pendientes > 0 && continuar) {
            if (callbacks.onLog) callbacks.onLog(`⏳ Quedan ${pendientes} productos pendientes. Continuando...`);
            ronda++;
            console.log(`🐛 DEBUG ejecutarFaseConLoop: Esperando 1s antes de siguiente ronda...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (pendientes === 0) {
            if (callbacks.onLog) callbacks.onLog(`✅ Batch ${batchNum} completado - Todos los productos verificados`);
            console.log(`🐛 DEBUG ejecutarFaseConLoop: Batch ${batchNum} completado`);
            continuar = false;
          }
        } catch (error) {
          console.log(`🐛 DEBUG ejecutarFaseConLoop: ERROR en batch ${batchNum}: ${error.message}`);
          throw new Error(`Error en batch ${batchNum}: ${error.message}`);
        }
      }

      // Advertir si se alcanzó el límite
      if (ronda > MAX_RONDAS) {
        console.log(`⚠️  ADVERTENCIA: Se alcanzó el límite de ${MAX_RONDAS} rondas para batch ${batchNum}`);
        if (callbacks.onLog) callbacks.onLog(`⚠️  Límite de ${MAX_RONDAS} rondas alcanzado para batch ${batchNum}. Continuando con siguiente batch...`);
      }

      // Pausa entre batches
      if (batchNum !== batches[batches.length - 1]) {
        console.log(`🐛 DEBUG ejecutarFaseConLoop: Pausa de 5s antes del siguiente batch...`);
        if (callbacks.onLog) callbacks.onLog(`⏸️  Pausa de 5s antes del siguiente batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`🐛 DEBUG ejecutarFaseConLoop: COMPLETADO - Todos los batches procesados`);
    if (callbacks.onLog) callbacks.onLog(`🎉 Verificación ${marketplace.toUpperCase()} completada para todos los batches`);
  }

  /**
   * Obtener lista de batches consolidados
   */
  getBatchesConsolidados(vendorDir) {
    if (!fs.existsSync(vendorDir)) return [];

    const files = fs.readdirSync(vendorDir);
    const batches = files
      .filter(file => file.match(/^batch-(\d+)-consolidated\.json$/))
      .map(file => parseInt(file.match(/batch-(\d+)/)[1]))
      .sort((a, b) => a - b);

    return batches;
  }

  /**
   * Ejecuta fase con iteración de batches (como MENU - para oportunidades)
   */
  async ejecutarFaseConIteracion(fase, vendedorId, callbacks = {}) {
    if (callbacks.onLog) callbacks.onLog(`🔄 Iniciando ${fase} con iteración de batches...`);

    // Verificar si hay batches
    const vendorDir = path.join(__dirname, '..', '..', 'data', 'vendors', vendedorId);
    const batches = this.getBatchesConsolidados(vendorDir);

    if (batches.length === 0) {
      throw new Error(`No se encontraron batches consolidados para ${vendedorId}`);
    }

    // Procesar cada batch (como MENU - línea 284-298 de menu-oportunidades.js)
    for (let i = 0; i < batches.length; i++) {
      const batchNum = batches[i];

      if (callbacks.onLog) callbacks.onLog(`\n📦 Procesando batch ${batchNum} (${i + 1}/${batches.length})...`);

      // Ejecutar script con batch específico
      const batchArgs = [batchNum.toString()];

      try {
        await this.ejecutarScript(fase, vendedorId, callbacks, batchArgs);
      } catch (error) {
        throw new Error(`Error en batch ${batchNum}: ${error.message}`);
      }

      // Pausa entre batches (como MENU - 2 segundos)
      if (i < batches.length - 1) {
        if (callbacks.onLog) callbacks.onLog(`⏸️  Pausa de 2s antes del siguiente batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (callbacks.onLog) callbacks.onLog(`🎉 ${fase} completada para todos los batches`);
  }

  /**
   * Verificar productos pendientes (igual que MENU)
   */
  verificarPendientes(vendorDir, batchNumber, marketplace) {
    const consolidatedFile = path.join(vendorDir, `batch-${batchNumber}-consolidated.json`);

    if (!fs.existsSync(consolidatedFile)) {
      return 0;
    }

    try {
      const fileContent = JSON.parse(fs.readFileSync(consolidatedFile, 'utf-8'));
      const data = Array.isArray(fileContent) ? fileContent : fileContent.all_products;

      if (!Array.isArray(data)) {
        return 0;
      }

      // Usar la misma lógica que MENU
      const campoFecha = marketplace === 'mx' ? 'fecha_verificacion_mx' : 'fecha_verificacion_usa';
      const campoDisponibilidad = marketplace === 'mx' ? 'disponibilidad_mx' : 'disponibilidad_usa';
      const campoPrecio = marketplace === 'mx' ? 'precio_actual_mx' : 'precio_actual_usd'; // USA usa 'usd' no 'usa'
      const campoVendedor = marketplace === 'mx' ? 'vendedor_actual_mx' : 'vendedor_actual_usa';
      const campoError = marketplace === 'mx' ? 'error_verificacion_mx' : 'error_verificacion_usa';

      const esPendiente = (producto) => {
        const fecha = producto[campoFecha];
        if (!fecha) return true;

        const disponibilidad = (producto[campoDisponibilidad] || '').toLowerCase();
        const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
        const missingCriticos = (!producto[campoPrecio] && !producto[campoVendedor]) && !producto[campoError];

        return requiereDatos && missingCriticos;
      };

      const pendientes = data.filter(esPendiente).length;
      return pendientes;
    } catch (e) {
      return 0;
    }
  }

  analizarSalida(text, fase, callbacks) {
    if (!callbacks.onProgress) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    let progressData = {};

    // 1. Patrón de Batch "Batch 5/20"
    const batchMatch = cleanText.match(/Batch\s+(\d+)\/(\d+)/i) || cleanText.match(/Lote\s+(\d+)\s+de\s+(\d+)/i);
    if (batchMatch) {
      progressData.batchActual = parseInt(batchMatch[1]);
      progressData.totalBatches = parseInt(batchMatch[2]);
    }

    // 2. Patrón de Productos "Procesando 50/100"
    const prodMatch = cleanText.match(/(?:Procesando|Productos?)\s+(\d+)\s*\/\s*(\d+)/i);
    if (prodMatch) {
      progressData.productosActual = parseInt(prodMatch[1]);
      progressData.totalProductos = parseInt(prodMatch[2]);
    }
    
    // 3. Patrones de "Completado" o "Pendientes"
    const pendientesMatch = cleanText.match(/Pendientes restantes:\s*(\d+)/i);
    if (pendientesMatch) {
         progressData.mensaje = `Pendientes: ${pendientesMatch[1]}`;
    }

    // Enviar actualización si hubo match
    if (Object.keys(progressData).length > 0) {
      progressData.faseActual = fase;
      callbacks.onProgress(progressData);
    }
    
    // Pasar la última línea como mensaje, limpiando un poco
    const lines = cleanText.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine && lastLine.length < 120 && !lastLine.startsWith('Error:')) {
        callbacks.onProgress({ mensaje: lastLine });
    }
  }

  detenerProceso() {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }
}

module.exports = new PhaseExecutor();