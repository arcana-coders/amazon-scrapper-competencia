const fs = require('fs');
const path = require('path');
const { intelligentScrapeCategory, CONFIG } = require('./intelligent-scraper');
const { chromium } = require('playwright');

const SELLER_ID = 'A338WHNLA63C6H';
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

async function testSingleCategory() {
  console.log('🧪 === PRUEBA DE CATEGORÍA ÚNICA CON SISTEMA INTELIGENTE ===');
  
  // Resetear solo Herramientas
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  const herramientasCategory = plan.categories.find(cat => cat.name === 'Herramientas y Mejoras del Hogar');
  
  if (herramientasCategory) {
    herramientasCategory.status = 'pending';
    herramientasCategory.file_path = null;
    herramientasCategory.started_at = null;
    herramientasCategory.completed_at = null;
    herramientasCategory.validation_result = null;
    
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    console.log('🔄 Herramientas y Mejoras del Hogar reseteada');
  }

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    // Usar el sistema inteligente
    await intelligentScrapeCategory(browser, 'Herramientas y Mejoras del Hogar', 485);
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    await browser.close();
  }
}

// Ejecutar
testSingleCategory();