const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 3) {
  console.log('❌ Uso: node reset-plan.js SELLER_ID');
  console.log('📋 Ejemplo: node reset-plan.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

/**
 * Resetea el plan para prueba completa
 */
function resetPlanForCompleteTest() {
  console.log('🔄 === RESETEANDO PLAN PARA PRUEBA COMPLETA ===');
  
  try {
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    
    console.log(`📋 Plan actual: ${plan.categories.length} categorías`);
    
    // Resetear todas las categorías a pending
    plan.categories.forEach((cat, i) => {
      const oldStatus = cat.status;
      cat.status = 'pending';
      cat.file_path = null;
      cat.started_at = null;
      cat.completed_at = null;
      cat.subcategories_found = 0;
      cat.validation_result = null;
      
      console.log(`  ${i + 1}. ${cat.name}: ${oldStatus} → pending`);
    });
    
    plan.last_updated = new Date().toISOString();
    
    // Guardar plan reseteado
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    
    console.log('\n✅ === PLAN RESETEADO ===');
    console.log(`📊 ${plan.categories.length} categorías listas para prueba completa:`);
    
    plan.categories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ⏳ ${cat.name} (${cat.expected_products || 'N/A'} productos)`);
    });
    
    console.log('\n🚀 Para ejecutar prueba completa:');
    console.log('   node complete-test.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (require.main === module) {
  resetPlanForCompleteTest();
}

module.exports = { resetPlanForCompleteTest };