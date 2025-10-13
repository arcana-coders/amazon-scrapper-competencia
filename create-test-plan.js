const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 3) {
  console.log('❌ Uso: node create-test-plan.js SELLER_ID');
  console.log('📋 Ejemplo: node create-test-plan.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

/**
 * Crea un plan de prueba con solo 4 categorías específicas
 */
function createTestPlan() {
  console.log('🧪 === CREANDO PLAN DE PRUEBA ===');
  console.log('🎯 Solo categorías: 1, 5, 7, 13 (índices 0, 4, 6, 12)');
  
  try {
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    
    // Mostrar todas las categorías con sus índices
    console.log('\n📋 Categorías disponibles:');
    plan.categories.forEach((cat, i) => {
      console.log(`  ${i}. [índice ${cat.index}] ${cat.name} (${cat.expected_products} productos)`);
    });
    
    // Seleccionar categorías de prueba (índices 0, 4, 6, 12)
    const testIndices = [0, 4, 6, 12];
    const testCategories = [];
    
    console.log('\n🎯 Categorías seleccionadas para prueba:');
    testIndices.forEach((targetIndex, newIndex) => {
      const category = plan.categories.find(cat => cat.index === targetIndex);
      if (category) {
        // Crear nueva categoría con índice actualizado
        const testCategory = {
          ...category,
          index: newIndex,
          status: 'pending'
        };
        testCategories.push(testCategory);
        console.log(`  ${newIndex + 1}. ${category.name} (${category.expected_products} productos)`);
      }
    });
    
    if (testCategories.length !== 4) {
      console.error('❌ No se pudieron encontrar todas las categorías requeridas');
      return;
    }
    
    // Crear nuevo plan de prueba
    const testPlan = {
      seller_id: SELLER_ID,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      total_categories: testCategories.length,
      test_mode: true,
      original_total: plan.total_categories,
      categories: testCategories
    };
    
    // Guardar plan de prueba
    const testPlanFile = path.join(OUTPUT_DIR, `${dateStr}-plan-test-${SELLER_ID}.json`);
    fs.writeFileSync(testPlanFile, JSON.stringify(testPlan, null, 2));
    
    // También actualizar el plan principal para usar solo estas categorías
    const modifiedPlan = {
      ...plan,
      total_categories: testCategories.length,
      test_mode: true,
      original_total: plan.total_categories,
      categories: testCategories,
      last_updated: new Date().toISOString()
    };
    
    fs.writeFileSync(PLAN_FILE, JSON.stringify(modifiedPlan, null, 2));
    
    console.log('\n✅ === PLAN DE PRUEBA CREADO ===');
    console.log(`📊 Total categorías de prueba: ${testCategories.length}/4`);
    
    let totalProducts = 0;
    testCategories.forEach((cat, i) => {
      totalProducts += cat.expected_products || 0;
      console.log(`  ${i + 1}. 📂 ${cat.name}: ${cat.expected_products} productos`);
    });
    
    console.log(`\n📊 Total productos estimados: ${totalProducts}`);
    console.log(`💾 Plan guardado en: ${path.basename(PLAN_FILE)}`);
    console.log(`💾 Backup en: ${path.basename(testPlanFile)}`);
    
    console.log('\n🚀 Para ejecutar prueba completa:');
    console.log('   node category-precise.js');
    console.log('   (repite 4 veces hasta completar todas)');
    
    console.log('\n🔍 Para verificar progreso:');
    console.log('   node check-precise.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (require.main === module) {
  createTestPlan();
}

module.exports = { createTestPlan };