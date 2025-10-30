const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENDOR_ID = 'A3Q5ASRA7J8Y5E';
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', VENDOR_ID);

console.log('🧪 === PRUEBA COMPLETA DE MODALIDADES DEL MENÚ ===\n');

// Función para simular selección de menú
function simulateMenuOption(option) {
    console.log(`\n📋 Probando Modalidad ${option}...`);
    
    try {
        // Simular la entrada del usuario para el menú
        const input = `${option}\n${VENDOR_ID}\n4\n`; // opción, vendedor, salir
        
        // Crear archivo temporal con la entrada
        const inputFile = path.join(__dirname, 'temp_input.txt');
        fs.writeFileSync(inputFile, input);
        
        // Ejecutar el menú con la entrada simulada
        const result = execSync(`node MENU.js < temp_input.txt`, { 
            encoding: 'utf8',
            timeout: 30000,
            cwd: __dirname
        });
        
        console.log('📤 Salida del menú:');
        console.log(result);
        
        // Limpiar archivo temporal
        if (fs.existsSync(inputFile)) {
            fs.unlinkSync(inputFile);
        }
        
        return result;
        
    } catch (error) {
        console.log(`❌ Error en modalidad ${option}:`, error.message);
        
        // Limpiar archivo temporal en caso de error
        const inputFile = path.join(__dirname, 'temp_input.txt');
        if (fs.existsSync(inputFile)) {
            fs.unlinkSync(inputFile);
        }
        
        return null;
    }
}

// Verificar archivos generados
function checkGeneratedFiles() {
    console.log('\n🔍 === VERIFICANDO ARCHIVOS GENERADOS ===');
    
    const expectedFiles = [
        'oportunidades.csv',
        'oportunidades_menos_50.csv', 
        'oportunidades_menos_100.csv',
        'vendedor-oportunidades.csv',
        'vendedor-oportunidades_menos_50.csv',
        'vendedor-oportunidades_menos_100.csv'
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
                
            } catch (err) {
                console.log(`   ❌ Error leyendo archivo: ${err.message}`);
            }
        } else {
            console.log(`❌ ${filename}: NO EXISTE`);
        }
    });
}

// Ejecutar pruebas
async function runTests() {
    console.log('🎯 Ejecutando pruebas de todas las modalidades...\n');
    
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
    
    // Probar cada modalidad
    console.log('\n📋 === INICIANDO PRUEBAS ===');
    
    // Modalidad 1: Batch específico
    console.log('\n1️⃣ === MODALIDAD 1: BATCH ESPECÍFICO ===');
    simulateMenuOption('1');
    
    // Modalidad 2: Todos los batches por separado  
    console.log('\n2️⃣ === MODALIDAD 2: TODOS LOS BATCHES ===');
    simulateMenuOption('2');
    
    // Modalidad 3: Consolidado
    console.log('\n3️⃣ === MODALIDAD 3: CONSOLIDADO ===');
    simulateMenuOption('3');
    
    // Verificar resultados
    checkGeneratedFiles();
    
    console.log('\n🏁 === PRUEBA COMPLETADA ===');
}

// Ejecutar
runTests().catch(console.error);