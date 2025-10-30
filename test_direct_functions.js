const fs = require('fs');
const path = require('path');

// Importar las funciones específicas del menú
const { generarOportunidadesConsolidadas } = require('./modules/menu-oportunidades.js');

const VENDOR_ID = 'A3Q5ASRA7J8Y5E';
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', VENDOR_ID);

console.log('🧪 === PRUEBA DIRECTA DE FUNCIONES DE OPORTUNIDADES ===\n');

// Verificar archivos generados
function checkGeneratedFiles(prefix = '') {
    console.log('\n🔍 === VERIFICANDO ARCHIVOS GENERADOS ===');
    
    const expectedFiles = [
        `${prefix}oportunidades.csv`,
        `${prefix}oportunidades_menos_50.csv`, 
        `${prefix}oportunidades_menos_100.csv`
    ];
    
    expectedFiles.forEach(filename => {
        const filePath = path.join(VENDOR_DIR, filename);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${filename}: EXISTE`);
            
            // Verificar si tiene precio_competitivo
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const hasPrecioCompetitivo = content.includes('precio_competitivo');
                console.log(`   📊 precio_competitivo: ${hasPrecioCompetitivo ? '✅ SÍ' : '❌ NO'}`);
                
                // Contar líneas (productos)
                const lines = content.split('\n').filter(line => line.trim());
                const productCount = lines.length > 1 ? lines.length - 1 : 0; // -1 por header
                console.log(`   📦 Productos: ${productCount}`);
                
                // Mostrar primeras líneas para verificar formato
                if (lines.length >= 2) {
                    console.log(`   📋 Header: ${lines[0]}`);
                    if (lines[1]) {
                        console.log(`   📄 Ejemplo: ${lines[1].substring(0, 100)}...`);
                    }
                }
                
            } catch (err) {
                console.log(`   ❌ Error leyendo archivo: ${err.message}`);
            }
        } else {
            console.log(`❌ ${filename}: NO EXISTE`);
        }
    });
}

// Función para probar modalidad 1 (batch específico)
async function testModalidad1() {
    console.log('\n1️⃣ === PROBANDO MODALIDAD 1: BATCH ESPECÍFICO ===');
    
    try {
        // Como no hay batches, vamos a simular directamente la función prepare_business_csv.js
        const { execSync } = require('child_process');
        
        // Primero verificar si existe el script
        const scriptPath = path.join(__dirname, 'prepare_business_csv.js');
        if (!fs.existsSync(scriptPath)) {
            console.log('❌ Script prepare_business_csv.js no encontrado');
            return;
        }
        
        console.log('🔄 Ejecutando prepare_business_csv.js directamente...');
        const result = execSync(`node prepare_business_csv.js ${VENDOR_ID}`, { 
            encoding: 'utf8',
            cwd: __dirname 
        });
        
        console.log('📤 Resultado:');
        console.log(result);
        
        checkGeneratedFiles();
        
    } catch (error) {
        console.log('❌ Error en modalidad 1:', error.message);
    }
}

// Función para probar modalidad 2 (todos los batches)
async function testModalidad2() {
    console.log('\n2️⃣ === PROBANDO MODALIDAD 2: TODOS LOS BATCHES ===');
    
    try {
        // Como no hay batches, vamos a simular directamente la función buscando_productos_csv.js
        const { execSync } = require('child_process');
        
        // Primero verificar si existe el script
        const scriptPath = path.join(__dirname, 'buscando_productos_csv.js');
        if (!fs.existsSync(scriptPath)) {
            console.log('❌ Script buscando_productos_csv.js no encontrado');
            return;
        }
        
        console.log('🔄 Ejecutando buscando_productos_csv.js directamente...');
        const result = execSync(`node buscando_productos_csv.js ${VENDOR_ID}`, { 
            encoding: 'utf8',
            cwd: __dirname 
        });
        
        console.log('📤 Resultado:');
        console.log(result);
        
        checkGeneratedFiles();
        
    } catch (error) {
        console.log('❌ Error en modalidad 2:', error.message);
    }
}

// Función para probar modalidad 3 (consolidado)
async function testModalidad3() {
    console.log('\n3️⃣ === PROBANDO MODALIDAD 3: CONSOLIDADO ===');
    
    try {
        console.log('🔄 Ejecutando generarOportunidadesConsolidadas...');
        await generarOportunidadesConsolidadas(VENDOR_ID);
        
        checkGeneratedFiles('vendedor-');
        
    } catch (error) {
        console.log('❌ Error en modalidad 3:', error.message);
        console.log('Stack:', error.stack);
    }
}

// Ejecutar pruebas
async function runTests() {
    console.log('🎯 Probando todas las modalidades de generación de oportunidades...\n');
    
    // Limpiar archivos anteriores
    console.log('🧹 Limpiando archivos anteriores...');
    const filesToClean = [
        'oportunidades.csv',
        'oportunidades_menos_50.csv', 
        'oportunidades_menos_100.csv',
        'vendedor-oportunidades.csv',
        'vendedor-oportunidades_menos_50.csv',
        'vendedor-oportunidades_menos_100.csv'
    ];
    
    filesToClean.forEach(filename => {
        const filePath = path.join(VENDOR_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Eliminado: ${filename}`);
        }
    });
    
    // Probar modalidad 3 (la que sabemos que funciona)
    await testModalidad3();
    
    // Probar modalidad 1 
    await testModalidad1();
    
    // Probar modalidad 2
    await testModalidad2();
    
    console.log('\n🏁 === PRUEBA COMPLETADA ===');
    console.log('\n📋 === RESUMEN FINAL ===');
    
    // Verificar todos los archivos al final
    const allFiles = [
        'oportunidades.csv',
        'oportunidades_menos_50.csv', 
        'oportunidades_menos_100.csv',
        'vendedor-oportunidades.csv',
        'vendedor-oportunidades_menos_50.csv',
        'vendedor-oportunidades_menos_100.csv'
    ];
    
    allFiles.forEach(filename => {
        const filePath = path.join(VENDOR_DIR, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const hasPrecioCompetitivo = content.includes('precio_competitivo');
            console.log(`${hasPrecioCompetitivo ? '✅' : '❌'} ${filename}: precio_competitivo ${hasPrecioCompetitivo ? 'SÍ' : 'NO'}`);
        } else {
            console.log(`❌ ${filename}: NO EXISTE`);
        }
    });
}

// Ejecutar
runTests().catch(console.error);