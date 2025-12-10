const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuración
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PROJECTS_FILE = path.join(PROJECT_ROOT, 'data', 'projects.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'automation');

// Asegurar directorio de logs
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, `daily-cycle-${new Date().toISOString().split('T')[0]}.log`);

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

async function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(PROJECT_ROOT, scriptName);
        log(`🚀 Ejecutando: node ${scriptName} ${args.join(' ')}`);

        const child = spawn('node', [scriptPath, ...args], {
            cwd: PROJECT_ROOT,
            shell: true
        });

        child.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) fs.appendFileSync(LOG_FILE, `  [STDOUT] ${output}\n`);
        });

        child.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) fs.appendFileSync(LOG_FILE, `  [STDERR] ${output}\n`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                log(`✅ Completado: ${scriptName}`);
                resolve();
            } else {
                log(`❌ Falló: ${scriptName} (Código: ${code})`);
                reject(new Error(`Script failed with code ${code}`));
            }
        });
    });
}

async function main() {
    log('==================================================');
    log('🤖 INICIANDO CICLO DIARIO DE AUTOMATIZACIÓN');
    log('==================================================');

    try {
        // 1. Cargar Vendedores
        if (!fs.existsSync(PROJECTS_FILE)) {
            throw new Error('No se encontró projects.json');
        }

        const projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        const vendors = projectsData.projects || {};
        const vendorIds = Object.keys(vendors);

        log(`📋 Vendedores encontrados: ${vendorIds.length}`);

        // 2. Procesar cada vendedor
        for (const sellerId of vendorIds) {
            const vendorName = vendors[sellerId].name || 'Desconocido';
            log(`\n🔄 Procesando Vendedor: ${vendorName} (${sellerId})`);

            try {
                // Paso 1: Scraping (Extract Products)
                // Nota: Usamos extract-products.js que ahora guarda en la ruta correcta
                await runScript('extract-products.js', [sellerId]);

                // Paso 2: Verificación MX
                // Lote 50 por defecto para no saturar
                await runScript('scripts/verify-products-mx-batch.js', [sellerId, '50']);

                // Paso 3: Verificación USA
                await runScript('scripts/verify-products-usa-batch.js', [sellerId, '50']);

                // Paso 4: Generar Oportunidades
                await runScript('prepare_business_csv.js', [sellerId]);
                await runScript('buscando_productos_csv.js', [sellerId]);

                log(`✨ Ciclo completado exitosamente para ${vendorName}`);

            } catch (err) {
                log(`⚠️ Error procesando ${vendorName}: ${err.message}`);
                // Continuamos con el siguiente vendedor
            }
        }

    } catch (error) {
        log(`💥 Error Fatal en el ciclo diario: ${error.message}`);
        process.exit(1);
    }

    log('\n==================================================');
    log('🏁 CICLO DIARIO FINALIZADO');
    log('==================================================');
}

main();
