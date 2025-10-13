const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A1VKD22N1RQ0B';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320; // 20 páginas × 16 productos

// Generar nombre de archivo con fecha
const today = new Date();
const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');

// Crear directorio de categorías si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Para evitar bucles infinitos y duplicados
const visitedUrls = new Set();
let currentCategoryResults = [];
const PROGRESS_FILE = path.join(OUTPUT_DIR, `${dateStr}-progress-${SELLER_ID}.json`);

/**
 * Normaliza una URL para evitar duplicados por parámetros diferentes
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Mantener solo parámetros esenciales y filtrar parámetros dinámicos 
    const essentialParams = ['me', 'rh', 'marketplaceID', 'i'];
    const newParams = new URLSearchParams();
    
    essentialParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        newParams.set(param, urlObj.searchParams.get(param));
      }
    });
    
    // Limpiar path de fragmentos dinámicos
    let cleanPath = urlObj.pathname;
    
    // Construir URL normalizada
    const normalizedUrl = `${urlObj.protocol}//${urlObj.hostname}${cleanPath}?${newParams.toString()}`;
    
    return normalizedUrl;
  } catch (e) {
    console.log(`⚠️ Error normalizando URL: ${url} - ${e.message}`);
    return url; // Si falla el parsing, devolver URL original
  }
}

/**
 * Extrae el número de productos de la página usando varios selectores posibles
 */
async function extractProductCount(page) {
  try {
    console.log('🔍 Extrayendo conteo de productos...');
    
    // En lugar de networkidle, esperemos a elementos específicos
    try {
      await page.waitForSelector('h2, .s-result-count, [data-component-type="s-result-info-bar"]', { timeout: 15000 });
      console.log('✅ Elementos de resultados detectados');
    } catch (e) {
      console.log('⚠️ No se detectaron elementos específicos, continuando...');
    }
    
    // Dar un tiempo adicional para que cargue completamente
    await page.waitForTimeout(2000);
    
    // Selectores posibles para el conteo de resultados - basados en la imagen
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"][class*="a-spacing-small"]',
      '.a-section.a-spacing-none.s-breadcrumb-with-all-filters h2',
      'h2',
      '.a-size-base'
    ];

    let resultText = '';
    let foundSelector = '';
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      
      try {
        const elements = await page.$$(selector);
        
        if (elements.length > 0) {
          for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            const text = await element.textContent();
            const trimmedText = text ? text.trim() : '';
            
            if (trimmedText && (
                trimmedText.includes('resultado') || 
                trimmedText.includes('de ') || 
                trimmedText.includes('producto') ||
                /\d+\s*-\s*\d+\s+de/i.test(trimmedText) || // "1-16 de..."
                trimmedText.includes('más de')
              )) {
              resultText = trimmedText;
              foundSelector = selector;
              console.log(`✅ Texto encontrado: "${trimmedText}"`);
              break;
            }
          }
          
          if (resultText) break;
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!resultText) {
      console.warn('⚠️ No se pudo encontrar el conteo de productos');
      return null;
    }

    // Patrones para extraer el número - optimizados para el formato "1-16 de más de 60,000 resultados"
    const patterns = [
      /\d+\s*-\s*\d+\s+de\s+más\s+de\s+([\d,]+)\s+resultado/i, // "1-16 de más de 60,000 resultados"
      /de\s+más\s+de\s+([\d,]+)\s+resultado/i, // "de más de 60,000 resultados"
      /\d+\s*-\s*\d+\s+de\s+([\d,]+)\s+resultado/i, // "1-16 de 245 resultados"
      /de\s+([\d,]+)\s+resultado/i, // "de 245 resultados"
      /más\s+de\s+([\d,]+)/i, // "más de 60,000"
      /([\d,]+)\s+resultado/i, // "60,000 resultados"
      /(\d+)\s*-\s*\d+\s+de\s+más\s+de\s+([\d,]+)/i, // Captura ambos números
      /(\d+)\s*-\s*\d+\s+de\s+([\d,]+)/i, // Captura ambos números sin "más de"
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = resultText.match(pattern);
      if (match) {
        // Tomar el número más grande encontrado (generalmente el total)
        const numbers = match.slice(1).filter(n => n).map(n => parseInt(n.replace(/,/g, ''), 10));
        const count = Math.max(...numbers);
        
        console.log(`🎯 Número extraído: ${count}`);
        
        // Si dice "más de X", asumir que es mayor a 320
        if (resultText.toLowerCase().includes('más de')) {
          return count > MAX_PRODUCTS_PER_CATEGORY ? count + 100 : count;
        }
        
        return count;
      }
    }

    console.warn('⚠️ No se pudo extraer el número de productos del texto');
    return null;
  } catch (error) {
    console.error('❌ Error al extraer conteo de productos:', error.message);
    return null;
  }
}

/**
 * Extrae las categorías/subcategorías del sidebar izquierdo
 */
async function extractCategories(page) {
  try {
    console.log('🔍 Extrayendo categorías...');
    const categories = [];
    
    // Selectores para las categorías en el sidebar
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]',
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]',
      '#departments a[href*="rh=n"]',
      '.s-navigation-container a[href*="rh=n"]',
      'a[href*="rh=n%3A"]'
    ];

    for (let i = 0; i < categorySelectors.length; i++) {
      const selector = categorySelectors[i];
      
      try {
        const elements = await page.$$(selector);
        
        if (elements.length > 0) {
          for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            
            try {
              const href = await element.getAttribute('href');
              const text = await element.textContent();
              const trimmedText = text ? text.trim() : '';
              
              if (href && trimmedText && href.includes('rh=n') && !href.includes('javascript:')) {
                const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
                
                // Verificar que contenga nuestro seller ID
                if (fullUrl.includes(SELLER_ID)) {
                  categories.push({
                    url: fullUrl,
                    name: trimmedText
                  });
                }
              }
            } catch (elementError) {
              // Continuar con el siguiente elemento
            }
          }
          
          if (categories.length > 0) {
            break;
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    // Eliminar duplicados
    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => c.url === cat.url)
    );

    console.log(`✅ Encontradas ${uniqueCategories.length} categorías`);
    return uniqueCategories;
  } catch (error) {
    console.error('❌ Error al extraer categorías:', error.message);
    return [];
  }
}

/**
 * Explora una categoría de manera recursiva
 */
async function exploreCategory(page, categoryUrl, categoryName = '', depth = 0) {
  const indent = '  '.repeat(depth);
  
  // Límite de profundidad para evitar recursión infinita
  if (depth > 4) {
    console.log(`${indent}⏹️ Profundidad máxima alcanzada (${depth}), saltando...`);
    return;
  }
  
  console.log(`${indent}🔍 Explorando: ${categoryName}`);

  // Normalizar URL para evitar duplicados
  const normalizedUrl = normalizeUrl(categoryUrl);
  
  // Evitar bucles infinitos
  if (visitedUrls.has(normalizedUrl)) {
    console.log(`${indent}⏭️ URL ya visitada, saltando...`);
    return;
  }
  
  visitedUrls.add(normalizedUrl);

  try {
    // Navegar a la categoría
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Esperar tiempo aleatorio (3-8 segundos)
    const delay = Math.floor(Math.random() * 5000) + 3000;
    console.log(`${indent}⏳ Esperando ${delay / 1000}s...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad humana
    try {
      await page.mouse.move(200, 300);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } catch (e) {
      // Ignorar errores de simulación
    }

    // Extraer número de productos
    const productCount = await extractProductCount(page);
    
    if (productCount === null) {
      console.log(`${indent}⚠️ No se pudo determinar el número de productos, saltando...`);
      return;
    }

    console.log(`${indent}📊 Productos encontrados: ${productCount}`);

    // LÓGICA CRÍTICA: Si es una hoja (≤320 productos), guardarla y NO buscar subcategorías
    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      const leafCategory = {
        url: categoryUrl,
        name: categoryName,
        productCount: productCount,
        isLeaf: true,
        depth: depth,
        timestamp: new Date().toISOString()
      };
      
      currentCategoryResults.push(leafCategory);
      console.log(`${indent}✅ CATEGORÍA VÁLIDA: ${productCount} productos (≤${MAX_PRODUCTS_PER_CATEGORY})`);
      return; // IMPORTANTE: Salir aquí para no buscar subcategorías
    }

    // Solo llegar aquí si productCount > MAX_PRODUCTS_PER_CATEGORY
    console.log(`${indent}🌳 Muchos productos (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY}), buscando subcategorías...`);
    const subcategories = await extractCategories(page);

    if (subcategories.length === 0) {
      console.log(`${indent}⚠️ No se encontraron subcategorías, guardando como hoja forzada`);
      currentCategoryResults.push({
        url: categoryUrl,
        name: categoryName,
        productCount: productCount,
        isLeaf: false,
        depth: depth,
        reason: 'no_subcategories',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log(`${indent}🔄 Explorando ${subcategories.length} subcategorías...`);
    
    // Explorar cada subcategoría recursivamente con límites de seguridad
    const maxSubcategories = Math.min(subcategories.length, 50); // Límite por nivel
    
    for (let i = 0; i < maxSubcategories; i++) {
      const subcat = subcategories[i];
      
      // Verificar que la subcategoría no sea igual a la categoría actual (evitar loops)
      const subcatNormalized = normalizeUrl(subcat.url);
      if (subcatNormalized === normalizedUrl) {
        console.log(`${indent}⚠️ Subcategoría igual a categoría actual, saltando...`);
        continue;
      }
      
      try {
        await exploreCategory(page, subcat.url, subcat.name, depth + 1);
      } catch (subcatError) {
        console.log(`${indent}❌ Error al explorar categoría: ${subcatError.message}`);
        
        // Guardar categoría con error
        currentCategoryResults.push({
          url: subcat.url,
          name: subcat.name,
          productCount: 0,
          isLeaf: false,
          depth: depth + 1,
          error: subcatError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (subcategories.length > maxSubcategories) {
      console.log(`${indent}⚠️ Procesadas ${maxSubcategories} de ${subcategories.length} subcategorías (límite alcanzado)`);
    }

  } catch (error) {
    console.error(`${indent}❌ Error al explorar categoría: ${error.message}`);
    
    // En caso de error, intentar guardar la categoría como hoja forzada
    currentCategoryResults.push({
      url: categoryUrl,
      name: categoryName,
      productCount: 0,
      isLeaf: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Guarda los resultados de una categoría principal en un archivo separado
 */
function saveCategoryResults(categoryName, categoryData) {
  try {
    // Limpiar nombre de categoría para nombre de archivo
    const cleanName = categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    // Verificar duplicados y crear estadísticas
    const uniqueUrls = [...new Set(categoryData.map(cat => cat.url))];
    const duplicateCount = categoryData.length - uniqueUrls.length;
    const depthLevels = categoryData.map(cat => cat.depth || 0);
    const maxDepth = Math.max(...depthLevels, 0);
    
    // Eliminar duplicados reales si los hay
    const uniqueSubcategories = categoryData.filter((cat, index, self) => 
      index === self.findIndex(c => c.url === cat.url)
    );
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        total_subcategories: uniqueSubcategories.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        status: "completed",
        unique_urls: uniqueUrls.length,
        duplicates_removed: duplicateCount,
        max_exploration_depth: maxDepth,
        leaf_categories: uniqueSubcategories.filter(cat => cat.isLeaf).length,
        branch_categories: uniqueSubcategories.filter(cat => !cat.isLeaf).length
      },
      subcategories: uniqueSubcategories
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    console.log(`💾 Archivo guardado: ${fileName}`);
    console.log(`📊 ${categoryData.length} subcategorías guardadas`);
    
    return filePath;
  } catch (error) {
    console.error('❌ Error guardando archivo de categoría:', error.message);
    return null;
  }
}

/**
 * Carga el progreso previo si existe
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📂 Progreso cargado: ${progress.completed_categories || 0} categorías completadas`);
      return progress;
    }
  } catch (error) {
    console.log(`⚠️ Error cargando progreso: ${error.message}`);
  }
  return { completed_categories: 0, processed_categories: [] };
}

/**
 * Guarda el progreso actual
 */
function saveProgress(processedCategories, currentIndex, totalCategories) {
  try {
    const progress = {
      last_updated: new Date().toISOString(),
      completed_categories: processedCategories.length,
      current_index: currentIndex,
      total_categories: totalCategories,
      processed_categories: processedCategories
    };
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`💾 Progreso guardado: ${processedCategories.length}/${totalCategories} categorías`);
  } catch (error) {
    console.error('❌ Error guardando progreso:', error.message);
  }
}

/**
 * Valida si una categoría está completa correctamente
 */
function validateCategoryCompletion(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Verificaciones de integridad
    const checks = {
      hasMetadata: !!data.metadata,
      hasSubcategories: Array.isArray(data.subcategories),
      statusComplete: data.metadata?.status === 'completed',
      noEmptyNames: data.subcategories?.every(cat => cat.name && cat.name.trim() !== ''),
      hasValidUrls: data.subcategories?.every(cat => cat.url && cat.url.includes('amazon.com.mx')),
      noDuplicateUrls: data.subcategories?.length === [...new Set(data.subcategories?.map(cat => cat.url))].length
    };
    
    const isValid = Object.values(checks).every(check => check === true);
    
    if (!isValid) {
      console.log(`⚠️ Validación fallida para ${path.basename(filePath)}:`, checks);
    }
    
    return {
      isValid,
      checks,
      subcategoryCount: data.subcategories?.length || 0,
      status: data.metadata?.status || 'unknown'
    };
    
  } catch (error) {
    console.log(`❌ Error validando ${filePath}: ${error.message}`);
    return { isValid: false, error: error.message };
  }
}

/**
 * Guarda un resumen final de todas las categorías procesadas
 */
function saveSummaryResults(processedCategories) {
  try {
    const summaryFile = path.join(OUTPUT_DIR, `${dateStr}-resumen-${SELLER_ID}.json`);
    
    const summary = {
      metadata: {
        seller_id: SELLER_ID,
        date_scraped: new Date().toISOString(),
        total_main_categories: processedCategories.length,
        total_subcategories: processedCategories.reduce((sum, cat) => sum + cat.subcategories_count, 0)
      },
      processed_categories: processedCategories
    };
    
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`💾 Resumen guardado: ${path.basename(summaryFile)}`);
    
    return summaryFile;
  } catch (error) {
    console.error('❌ Error guardando resumen:', error.message);
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 EXPLORADOR MODULAR DE CATEGORÍAS - Amazon México');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  console.log(`📁 Archivos se guardarán en: ${OUTPUT_DIR}`);

  // Buscar cookie para Amazon México
  const possibleCookiePaths = [
    path.join(__dirname, 'scripts', 'auth', 'amazonmx.json'),
    path.join(__dirname, 'scripts', 'auth', 'pedirplantilla.json'),
    path.join(__dirname, 'auth', 'amazonmx.json')
  ];
  
  let cookiePath = null;
  for (const possiblePath of possibleCookiePaths) {
    if (fs.existsSync(possiblePath)) {
      cookiePath = possiblePath;
      console.log(`🍪 Cookie encontrada: ${possiblePath}`);
      break;
    }
  }

  if (!cookiePath) {
    console.error('❌ CRÍTICO: No se encontró cookie para Amazon México');
    console.error('🔑 DEBES ejecutar primero: node scripts/a-login.js');
    process.exit(1);
  }

  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    storageState: cookiePath,
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  };
  
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Manejar interrupción del usuario (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('\n⚠️ Interrupción detectada, cerrando navegador...');
    await browser.close();
    console.log('👋 Exploración interrumpida.');
    process.exit(0);
  });

  try {
    console.log('🔗 Accediendo a la tienda principal...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Extraer las categorías principales
    console.log('🔍 Extrayendo categorías principales...');
    const mainCategories = await extractCategories(page);
    
    if (mainCategories.length === 0) {
      console.error('❌ No se encontraron categorías principales');
      return;
    }
    
    console.log(`✅ Encontradas ${mainCategories.length} categorías principales`);
    
    // Cargar progreso previo
    const previousProgress = loadProgress();
    let processedCategories = previousProgress.processed_categories || [];
    let startIndex = previousProgress.current_index || 0;
    
    console.log(`🔄 Continuando desde categoría ${startIndex + 1}/${mainCategories.length}`);
    
    // Procesar cada categoría principal una por una (desde donde se quedó)
    for (let i = startIndex; i < mainCategories.length; i++) {
      const category = mainCategories[i];
      console.log(`\n🚀 === PROCESANDO CATEGORÍA ${i + 1}/${mainCategories.length}: ${category.name} ===`);
      
      // Verificar si ya existe el archivo para esta categoría (evitar reprocesar)
      const cleanName = category.name.toLowerCase()
        .replace(/[^a-z0-9áéíóúñü\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      
      if (fs.existsSync(filePath)) {
        console.log(`📁 Archivo existe: ${fileName}, validando completitud...`);
        
        // Validar si la categoría está completa
        const validation = validateCategoryCompletion(filePath);
        
        if (validation.isValid && validation.status === 'completed') {
          console.log(`✅ Categoría ya completa y válida, saltando...`);
          
          // Cargar información del archivo existente para el resumen
          try {
            const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const existingCategory = {
              name: category.name,
              url: category.url,
              subcategories_count: validation.subcategoryCount,
              file_path: fileName,
              processed_at: existingData.metadata.date_scraped,
              status: 'already_completed',
              validation: validation.checks
            };
            
            // Solo añadir si no está ya en la lista
            if (!processedCategories.find(cat => cat.name === category.name)) {
              processedCategories.push(existingCategory);
            }
            
          } catch (e) {
            console.log(`⚠️ Error leyendo archivo existente: ${e.message}`);
          }
          continue;
        } else {
          console.log(`⚠️ Archivo incompleto o inválido, reprocesando...`);
          console.log(`   - Subcategorías: ${validation.subcategoryCount}`);
          console.log(`   - Estado: ${validation.status}`);
          // Continuar procesando para completar/corregir
        }
      }
      
      // Limpiar resultados para esta categoría principal
      currentCategoryResults = [];
      visitedUrls.clear();
      
      // Pausa antes de explorar cada categoría principal
      const pause = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
      console.log(`⏳ Pausa antes de explorar: ${pause / 1000}s`);
      await page.waitForTimeout(pause);
      
      try {
        // Explorar esta categoría principal
        await exploreCategory(page, category.url, category.name, 0);
        
        // Guardar resultados de esta categoría
        const savedFilePath = saveCategoryResults(category.name, currentCategoryResults);
        
        const completedCategory = {
          name: category.name,
          url: category.url,
          subcategories_count: currentCategoryResults.length,
          file_path: savedFilePath ? path.basename(savedFilePath) : null,
          processed_at: new Date().toISOString(),
          status: 'completed'
        };
        
        // Solo añadir si no está ya en la lista
        const existingIndex = processedCategories.findIndex(cat => cat.name === category.name);
        if (existingIndex >= 0) {
          processedCategories[existingIndex] = completedCategory;
        } else {
          processedCategories.push(completedCategory);
        }
        
        console.log(`✅ Categoría completada: ${currentCategoryResults.length} subcategorías encontradas`);
        
        // Guardar progreso después de cada categoría
        saveProgress(processedCategories, i + 1, mainCategories.length);
        
      } catch (categoryError) {
        console.error(`❌ Error procesando categoría ${category.name}:`, categoryError.message);
        const errorCategory = {
          name: category.name,
          url: category.url,
          subcategories_count: 0,
          file_path: null,
          processed_at: new Date().toISOString(),
          status: 'error',
          error: categoryError.message
        };
        
        // Solo añadir si no está ya en la lista
        const existingIndex = processedCategories.findIndex(cat => cat.name === category.name);
        if (existingIndex >= 0) {
          processedCategories[existingIndex] = errorCategory;
        } else {
          processedCategories.push(errorCategory);
        }
        
        // Guardar progreso incluso con error
        saveProgress(processedCategories, i + 1, mainCategories.length);
      }
      
      // Pausa entre categorías principales
      if (i < mainCategories.length - 1) {
        const betweenPause = Math.floor(Math.random() * 5000) + 3000; // 3-8 segundos
        console.log(`⏸️ Pausa entre categorías: ${betweenPause / 1000}s`);
        await page.waitForTimeout(betweenPause);
      }
    }
    
    // Guardar resumen final
    saveSummaryResults(processedCategories);
    
    // Limpiar archivo de progreso al completar todo
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🧹 Archivo de progreso limpiado');
    }
    
    console.log('\n📊 === PROCESAMIENTO COMPLETADO ===');
    console.log(`✅ Total de categorías principales procesadas: ${processedCategories.length}`);
    console.log(`📁 Archivos generados en: ${OUTPUT_DIR}`);
    console.log('\n📋 Archivos creados:');
    processedCategories.forEach((cat, index) => {
      const statusIcon = cat.status === 'completed' ? '✅' : 
                        cat.status === 'already_completed' ? '♻️' : 
                        cat.status === 'error' ? '❌' : '⚠️';
      console.log(`  ${index + 1}. ${statusIcon} ${cat.file_path} (${cat.subcategories_count} subcategorías) - ${cat.status}`);
    });
    
    // Validar todos los archivos al final
    console.log('\n🔍 === VALIDACIÓN FINAL ===');
    const validationResults = processedCategories
      .filter(cat => cat.file_path)
      .map(cat => {
        const fullPath = path.join(OUTPUT_DIR, cat.file_path);
        return {
          name: cat.name,
          file: cat.file_path,
          validation: validateCategoryCompletion(fullPath)
        };
      });
    
    const validFiles = validationResults.filter(r => r.validation.isValid);
    const invalidFiles = validationResults.filter(r => !r.validation.isValid);
    
    console.log(`✅ Archivos válidos: ${validFiles.length}/${validationResults.length}`);
    if (invalidFiles.length > 0) {
      console.log(`❌ Archivos con problemas:`);
      invalidFiles.forEach(f => {
        console.log(`   - ${f.file}: ${f.validation.error || 'Validación fallida'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error en la función principal:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar el script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { main, exploreCategory, extractProductCount, extractCategories };