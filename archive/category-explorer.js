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
const leafCategories = [];

/**
 * Guarda el progreso actual en un archivo temporal
 */
function saveProgress() {
  try {
    const progressFile = path.join(__dirname, 'data', 'progress.json');
    const progress = {
      timestamp: new Date().toISOString(),
      visitedUrls: Array.from(visitedUrls),
      leafCategories: leafCategories,
      totalFound: leafCategories.length,
      totalVisited: visitedUrls.size
    };
    
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    console.log(`💾 Progreso guardado: ${leafCategories.length} categorías, ${visitedUrls.size} URLs visitadas`);
  } catch (error) {
    console.error('❌ Error guardando progreso:', error.message);
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
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        total_subcategories: categoryData.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY
      },
      subcategories: categoryData
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
 * Carga el progreso previo si existe
 */
function loadProgress() {
  try {
    const progressFile = path.join(__dirname, 'data', 'progress.json');
    if (fs.existsSync(progressFile)) {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      
      // Restaurar URLs visitadas
      progress.visitedUrls.forEach(url => visitedUrls.add(url));
      
      // Restaurar categorías encontradas
      leafCategories.push(...progress.leafCategories);
      
      console.log(`📂 Progreso cargado: ${leafCategories.length} categorías, ${visitedUrls.size} URLs visitadas`);
      console.log(`⏰ Última ejecución: ${progress.timestamp}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error cargando progreso:', error.message);
  }
  return false;
}

/**
 * Normaliza una URL para evitar duplicados por parámetros diferentes
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Mantener solo parámetros esenciales
    const essentialParams = ['me', 'rh', 'marketplaceID'];
    const newParams = new URLSearchParams();
    
    essentialParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        newParams.set(param, urlObj.searchParams.get(param));
      }
    });
    
    urlObj.search = newParams.toString();
    return urlObj.toString();
  } catch (e) {
    return url; // Si falla el parsing, devolver URL original
  }
}

/**
 * Extrae el número de productos de la página usando varios selectores posibles
 */
async function extractProductCount(page) {
  try {
    console.log('🔍 DEBUG: Iniciando extracción de conteo de productos...');
    
    // En lugar de networkidle, esperemos a elementos específicos
    try {
      // Esperar a que aparezca algún elemento que indique que los resultados están cargados
      await page.waitForSelector('span[data-component-type="s-result-info-bar"], .s-result-count, h2', { timeout: 15000 });
      console.log('✅ DEBUG: Elementos de resultados detectados');
    } catch (e) {
      console.log('⚠️ DEBUG: No se detectaron elementos específicos, continuando...');
    }
    
    // Dar un tiempo adicional para que cargue completamente
    await page.waitForTimeout(2000);
    console.log('✅ DEBUG: Esperado 2 segundos adicionales');
    
    // Obtener título de la página para debug
    const pageTitle = await page.title();
    console.log(`📄 DEBUG: Título de página: "${pageTitle}"`);
    
    // Selectores posibles para el conteo de resultados - basados en la imagen
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal', // El selector específico de la imagen
      'h2[class*="a-size-base"][class*="a-spacing-small"]', // Más genérico
      '.a-section.a-spacing-none.s-breadcrumb-with-all-filters h2', // Contenedor específico
      '.s-result-count',
      '[data-component-type="s-result-info-bar"] span',
      '.sg-col-inner .a-section span',
      'h1 .a-size-base',
      '.s-desktop-toolbar span',
      '[data-component-type="s-result-info-bar"]',
      '.s-desktop-content .sg-col-inner span',
      '.s-result-info-bar span',
      'span[data-component-type="s-result-info-bar"]',
      'h2', // Selector genérico para h2
      '.a-size-base' // Selector genérico para el tamaño de texto
    ];

    let resultText = '';
    let foundSelector = '';
    
    console.log(`🔍 DEBUG: Probando ${selectors.length} selectores diferentes...`);
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      console.log(`🎯 DEBUG: Probando selector ${i + 1}/${selectors.length}: "${selector}"`);
      
      try {
        const elements = await page.$$(selector);
        console.log(`   📦 DEBUG: Encontrados ${elements.length} elementos con este selector`);
        
        if (elements.length > 0) {
          for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            const text = await element.textContent();
            const trimmedText = text ? text.trim() : '';
            
            console.log(`   📝 DEBUG: Elemento ${j + 1}: "${trimmedText}"`);
            
            if (trimmedText && (
                trimmedText.includes('resultado') || 
                trimmedText.includes('de ') || 
                trimmedText.includes('producto') ||
                /\d+\s*-\s*\d+\s+de/i.test(trimmedText) || // "1-16 de..."
                trimmedText.includes('más de')
              )) {
              resultText = trimmedText;
              foundSelector = selector;
              console.log(`   ✅ DEBUG: ¡Texto válido encontrado con selector "${selector}"!`);
              break;
            }
          }
          
          if (resultText) break;
        }
      } catch (e) {
        console.log(`   ❌ DEBUG: Error con selector "${selector}": ${e.message}`);
      }
    }

    // Si no encontramos nada, buscar cualquier texto que contenga números
    if (!resultText) {
      console.log('🔍 DEBUG: No se encontró texto específico, buscando cualquier texto con números...');
      
      const allTextSelectors = [
        'span',
        'div',
        'h1',
        'h2',
        '.a-size-base',
        '.a-size-small'
      ];
      
      for (const selector of allTextSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const text = await element.textContent();
            const trimmedText = text ? text.trim() : '';
            
            if (trimmedText && /\d/.test(trimmedText) && trimmedText.length < 200) {
              console.log(`   🔢 DEBUG: Texto con números encontrado: "${trimmedText}"`);
              
              if (trimmedText.includes('resultado') || trimmedText.includes('producto') || 
                  /de\s+\d+/i.test(trimmedText) || /\d+\s+resultado/i.test(trimmedText)) {
                resultText = trimmedText;
                foundSelector = selector;
                console.log(`   ✅ DEBUG: ¡Texto válido encontrado!`);
                break;
              }
            }
          }
          
          if (resultText) break;
        } catch (e) {
          // Continuar con el siguiente selector
        }
      }
    }

    console.log(`📊 DEBUG: Texto final encontrado: "${resultText}"`);
    console.log(`🎯 DEBUG: Selector exitoso: "${foundSelector}"`);

    if (!resultText) {
      console.warn('⚠️ DEBUG: No se pudo encontrar el conteo de productos');
      
      // Como último recurso, tomar screenshot para debug
      try {
        const timestamp = new Date().getTime();
        const screenshotPath = path.join(__dirname, 'debug', `no-count-${timestamp}.png`);
        if (!fs.existsSync(path.dirname(screenshotPath))) {
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        }
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 DEBUG: Screenshot guardado en ${screenshotPath}`);
      } catch (e) {
        console.log('❌ DEBUG: No se pudo tomar screenshot');
      }
      
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
      /mostrando\s+\d+\s*-\s*\d+\s+de\s+([\d,]+)/i,
      /(\d+[\d,]*)\s+producto/i
    ];

    console.log(`🔍 DEBUG: Probando ${patterns.length} patrones de regex...`);
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      console.log(`🎯 DEBUG: Probando patrón ${i + 1}: ${pattern}`);
      
      const match = resultText.match(pattern);
      if (match) {
        console.log(`   ✅ DEBUG: ¡Match encontrado!`, match);
        
        // Tomar el número más grande encontrado (generalmente el total)
        const numbers = match.slice(1).filter(n => n).map(n => parseInt(n.replace(/,/g, ''), 10));
        const count = Math.max(...numbers);
        
        console.log(`   📊 DEBUG: Números extraídos:`, numbers);
        console.log(`   🎯 DEBUG: Número final seleccionado: ${count}`);
        
        // Si dice "más de X", asumir que es mayor a 320
        if (resultText.toLowerCase().includes('más de')) {
          console.log(`   📈 DEBUG: Texto contiene "más de", ajustando número...`);
          return count > MAX_PRODUCTS_PER_CATEGORY ? count + 100 : count;
        }
        
        return count;
      }
    }

    console.warn('⚠️ DEBUG: No se pudo extraer el número de productos del texto con ningún patrón');
    console.log('🔍 DEBUG: Texto completo para análisis manual:', JSON.stringify(resultText));
    
    return null;
  } catch (error) {
    console.error('❌ DEBUG: Error al extraer conteo de productos:', error.message);
    console.error('❌ DEBUG: Stack trace:', error.stack);
    return null;
  }
}

/**
 * Extrae las categorías/subcategorías del sidebar izquierdo
 */
async function extractCategories(page) {
  try {
    console.log('🔍 DEBUG: Iniciando extracción de categorías...');
    const categories = [];
    
    // Selectores para las categorías en el sidebar
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]',
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]',
      '#departments a[href*="rh=n"]',
      '.s-navigation-container a[href*="rh=n"]',
      '.s-ref-checkbox-wrapper a[href*="rh=n"]',
      'a[href*="rh=n%3A"]'
    ];

    console.log(`🔍 DEBUG: Probando ${categorySelectors.length} selectores para categorías...`);

    for (let i = 0; i < categorySelectors.length; i++) {
      const selector = categorySelectors[i];
      console.log(`🎯 DEBUG: Probando selector ${i + 1}/${categorySelectors.length}: "${selector}"`);
      
      try {
        const elements = await page.$$(selector);
        console.log(`   📦 DEBUG: Encontrados ${elements.length} elementos con este selector`);
        
        if (elements.length > 0) {
          for (let j = 0; j < Math.min(elements.length, 10); j++) { // Limitar a 10 para no llenar la pantalla
            const element = elements[j];
            
            try {
              const href = await element.getAttribute('href');
              const text = await element.textContent();
              const trimmedText = text ? text.trim() : '';
              
              console.log(`   📝 DEBUG: Elemento ${j + 1}:`);
              console.log(`       Texto: "${trimmedText}"`);
              console.log(`       Href: "${href}"`);
              
              if (href && trimmedText && href.includes('rh=n') && !href.includes('javascript:')) {
                const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
                
                console.log(`       URL completa: "${fullUrl}"`);
                console.log(`       Contiene seller ID (${SELLER_ID}): ${fullUrl.includes(SELLER_ID)}`);
                
                // Verificar que contenga nuestro seller ID
                if (fullUrl.includes(SELLER_ID)) {
                  categories.push({
                    url: fullUrl,
                    name: trimmedText
                  });
                  console.log(`       ✅ DEBUG: Categoría añadida!`);
                } else {
                  console.log(`       ⚠️ DEBUG: No contiene seller ID, ignorando`);
                }
              } else {
                console.log(`       ⚠️ DEBUG: No cumple criterios (href válido, texto válido, contiene rh=n, no es javascript)`);
              }
            } catch (elementError) {
              console.log(`   ❌ DEBUG: Error procesando elemento ${j + 1}: ${elementError.message}`);
            }
          }
          
          if (elements.length > 10) {
            console.log(`   ... DEBUG: (${elements.length - 10} elementos adicionales no mostrados)`);
          }
        }
        
        if (categories.length > 0) {
          console.log(`   ✅ DEBUG: Selector exitoso, encontradas ${categories.length} categorías`);
          break;
        }
      } catch (e) {
        console.log(`   ❌ DEBUG: Error con selector "${selector}": ${e.message}`);
      }
    }

    // Si no encontramos categorías, buscar cualquier enlace que parezca ser de categoría
    if (categories.length === 0) {
      console.log('🔍 DEBUG: No se encontraron categorías específicas, buscando cualquier enlace relacionado...');
      
      try {
        const allLinks = await page.$$('a[href*="amazon.com"]');
        console.log(`📦 DEBUG: Encontrados ${allLinks.length} enlaces de Amazon para analizar...`);
        
        for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
          const link = allLinks[i];
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          const trimmedText = text ? text.trim() : '';
          
          if (href && trimmedText && (href.includes('rh=') || href.includes('node=')) && trimmedText.length < 100) {
            console.log(`   🔗 DEBUG: Enlace potencial encontrado:`);
            console.log(`       Texto: "${trimmedText}"`);
            console.log(`       Href: "${href}"`);
          }
        }
      } catch (e) {
        console.log(`❌ DEBUG: Error buscando enlaces alternativos: ${e.message}`);
      }
    }

    // Eliminar duplicados
    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => c.url === cat.url)
    );

    console.log(`🏷️ DEBUG: Total de categorías únicas encontradas: ${uniqueCategories.length}`);
    
    if (uniqueCategories.length > 0) {
      console.log('📋 DEBUG: Categorías encontradas:');
      uniqueCategories.forEach((cat, index) => {
        console.log(`   ${index + 1}. "${cat.name}"`);
        console.log(`      URL: ${cat.url}`);
      });
    } else {
      // Tomar screenshot para debug si no encontramos categorías
      try {
        const timestamp = new Date().getTime();
        const screenshotPath = path.join(__dirname, 'debug', `no-categories-${timestamp}.png`);
        if (!fs.existsSync(path.dirname(screenshotPath))) {
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        }
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 DEBUG: Screenshot guardado en ${screenshotPath}`);
      } catch (e) {
        console.log('❌ DEBUG: No se pudo tomar screenshot');
      }
    }

    return uniqueCategories;
  } catch (error) {
    console.error('❌ DEBUG: Error al extraer categorías:', error.message);
    console.error('❌ DEBUG: Stack trace:', error.stack);
    return [];
  }
}

/**
 * Explora una categoría de manera recursiva
 */
async function exploreCategory(page, categoryUrl, categoryName = '', depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}🔍 Explorando: ${categoryName} (${categoryUrl})`);

  // Normalizar URL para evitar duplicados
  const normalizedUrl = normalizeUrl(categoryUrl);
  
  // Evitar bucles infinitos
  if (visitedUrls.has(normalizedUrl)) {
    console.log(`${indent}⏭️ URL ya visitada (normalizada), saltando...`);
    console.log(`${indent}    Original: ${categoryUrl}`);
    console.log(`${indent}    Normalizada: ${normalizedUrl}`);
    return;
  }
  
  visitedUrls.add(normalizedUrl);
  console.log(`${indent}📝 DEBUG: URL añadida a visitadas (total: ${visitedUrls.size})`);
  
  // Guardar progreso cada 5 categorías exploradas
  if (visitedUrls.size % 5 === 0) {
    saveProgress();
  }

  try {
    // Navegar a la categoría MUY lentamente
    console.log(`${indent}🌐 Navegando LENTAMENTE a: ${categoryUrl}`);
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Verificar que llegamos a la página correcta
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`${indent}📄 URL actual: ${currentUrl}`);
    console.log(`${indent}📄 Título: "${pageTitle}"`);
    
    // Esperar tiempo aleatorio moderado
    const delay = Math.floor(Math.random() * 5000) + 3000; // 3-8 segundos
    console.log(`${indent}⏳ Esperando ${delay / 1000}s...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad humana en la página
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
    console.log(`${indent}📊 DEBUG: Iniciando extracción de conteo de productos...`);
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
        timestamp: new Date().toISOString()
      };
      
      leafCategories.push(leafCategory);
      console.log(`${indent}✅ CATEGORÍA VÁLIDA GUARDADA: ${productCount} productos (≤${MAX_PRODUCTS_PER_CATEGORY})`);
      console.log(`${indent}    NO se buscarán subcategorías para esta categoría`);
      
      // Guardar progreso inmediatamente cuando encontramos una categoría válida
      saveProgress();
      return; // IMPORTANTE: Salir aquí para no buscar subcategorías
    }

    // Solo llegar aquí si productCount > MAX_PRODUCTS_PER_CATEGORY
    console.log(`${indent}🌳 MUCHOS productos (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY}), buscando subcategorías...`);
    const subcategories = await extractCategories(page);

    if (subcategories.length === 0) {
      console.log(`${indent}⚠️ No se encontraron subcategorías, guardando como hoja forzada`);
      leafCategories.push({
        url: categoryUrl,
        name: categoryName,
        productCount: productCount,
        isLeaf: false, // Marca que no es realmente una hoja pero no tiene más subdivisiones
        reason: 'no_subcategories',
        timestamp: new Date().toISOString()
      });
      saveProgress();
      return;
    }

    console.log(`${indent}🔄 Explorando ${subcategories.length} subcategorías...`);
    
    // Explorar cada subcategoría recursivamente
    for (let i = 0; i < subcategories.length; i++) {
      const subcat = subcategories[i];
      console.log(`${indent}📂 Subcategoría ${i + 1}/${subcategories.length}: ${subcat.name}`);
      
      // Verificar que la subcategoría no sea igual a la categoría actual (evitar loops)
      const subcatNormalized = normalizeUrl(subcat.url);
      if (subcatNormalized === normalizedUrl) {
        console.log(`${indent}⚠️ Subcategoría igual a categoría actual, saltando...`);
        continue;
      }
      
      await exploreCategory(page, subcat.url, subcat.name, depth + 1);
    }

  } catch (error) {
    console.error(`${indent}❌ Error al explorar categoría: ${error.message}`);
    
    // En caso de error, intentar guardar la categoría como hoja forzada
    leafCategories.push({
      url: categoryUrl,
      name: categoryName,
      productCount: 0,
      isLeaf: false,
      error: error.message
    });
  }
}

/**
 * Verifica si necesita generar una nueva cookie
 */
async function checkCookieNeeded() {
  const cookiePath = path.join(__dirname, 'scripts', 'auth', 'pedirplantilla.json');
  
  if (!fs.existsSync(cookiePath)) {
    console.log('⚠️ No se encontró archivo de cookie.');
    console.log('🔑 Es recomendable generar una cookie para evitar bloqueos.');
    console.log('💡 Ejecuta: node scripts/a-login.js');
    return false;
  }
  
  // Verificar si la cookie es muy antigua (más de 5 horas)
  try {
    const stats = fs.statSync(cookiePath);
    const hoursOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
    
    if (hoursOld > 5) {
      console.log(`⚠️ Cookie tiene ${hoursOld.toFixed(1)} horas de antigüedad.`);
      console.log('🔄 Se recomienda generar una nueva cookie.');
      console.log('💡 Ejecuta: node scripts/a-login.js');
      return false;
    } else {
      console.log(`✅ Cookie válida (${hoursOld.toFixed(1)} horas de antigüedad)`);
      return true;
    }
  } catch (error) {
    console.log('⚠️ Error verificando cookie:', error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando explorador de categorías de Amazon...');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  
  // Verificar estado de la cookie
  await checkCookieNeeded();
  
  // Cargar progreso previo si existe
  const hasProgress = loadProgress();
  if (hasProgress) {
    console.log('🔄 Continuando desde progreso anterior...');
  } else {
    console.log('🆕 Iniciando exploración desde cero...');
  }

  // Crear directorio data si no existe
  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Buscar cookie para Amazon México
  const possibleCookiePaths = [
    path.join(__dirname, 'scripts', 'auth', 'amazonmx.json'),  // Cookie específica para Amazon MX
    path.join(__dirname, 'scripts', 'auth', 'pedirplantilla.json'), // Cookie anterior (Seller Central)
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
    console.error('📋 Se buscó en:');
    possibleCookiePaths.forEach(p => console.error(`   - ${p}`));
    console.error('⚠️ Sin cookie válida, Amazon nos bloqueará inmediatamente.');
    process.exit(1);
  }
  
  console.log(`🍪 Usando cookie: ${cookiePath}`);
  
  // Verificar edad de la cookie
  const stats = fs.statSync(cookiePath);
  const hoursOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
  console.log(`� Cookie tiene ${hoursOld.toFixed(1)} horas de antigüedad`);
  
  if (hoursOld > 5) {
    console.error('⚠️ ADVERTENCIA: Cookie muy antigua, puede fallar');
    console.error('🔄 Considera regenerar: node scripts/a-login.js');
  }

  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  // Configuración súper realista para evitar detección
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
  
  console.log(`✅ Configurando navegador con cookie y headers reales`);
  
  const context = await browser.newContext(contextOptions);

  const page = await context.newPage();
  
  // Configurar comportamiento más humano
  await page.setDefaultTimeout(30000);
  await page.setDefaultNavigationTimeout(30000);
  
  // Simular un usuario real: mover mouse, hacer scroll, etc.
  page.on('load', async () => {
    try {
      // Mover el mouse de forma natural
      await page.mouse.move(100, 100);
      await page.waitForTimeout(500);
      await page.mouse.move(300, 200);
      await page.waitForTimeout(300);
      
      // Scroll suave hacia abajo y hacia arriba
      await page.evaluate(() => {
        window.scrollTo({ top: 200, behavior: 'smooth' });
      });
      await page.waitForTimeout(1000);
      
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (e) {
      // Ignorar errores de simulación
    }
  });

  // Manejar interrupción del usuario (Ctrl+C)
  process.on('SIGINT', async () => {
    console.log('\n⚠️ Interrupción detectada, guardando progreso...');
    saveProgress();
    
    // Guardar archivo final con lo que tenemos hasta ahora
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(leafCategories, null, 2));
    console.log(`💾 Archivo final guardado con ${leafCategories.length} categorías: ${OUTPUT_FILE}`);
    
    await browser.close();
    console.log('👋 Exploración interrumpida. Progreso guardado.');
    process.exit(0);
  });

  try {
    console.log('🔗 MODO CONSERVADOR: Solo abriendo página principal...');
    console.log(`🎯 URL: ${BASE_URL}`);
    console.log('⏳ Navegando MUY lentamente para evitar detección...');
    
    // Navegación súper lenta y natural
    await page.goto(BASE_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    console.log('✅ Página cargada, esperando 10 segundos...');
    await page.waitForTimeout(10000);
    
    // Verificar que estamos en la página correcta
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`📄 URL actual: ${currentUrl}`);
    console.log(`📄 Título: "${pageTitle}"`);
    
    // Verificar si hay signos de bloqueo REALES (más específicos)
    const bodyText = await page.textContent('body');
    const realBlocks = [
      'enter the characters you see below',
      'please verify',
      'we just need to make sure',
      'unusual traffic',
      'tráfico inusual',
      'verificación de seguridad',
      'captcha',
      'blocked'
    ];
    
    const actualBlock = realBlocks.find(term => 
      bodyText.toLowerCase().includes(term.toLowerCase())
    );
    
    if (actualBlock) {
      console.error(`🚫 BLOQUEO REAL DETECTADO: "${actualBlock}"`);
      console.error('⚠️ Amazon está pidiendo verificación');
    } else {
      console.log('✅ No se detectaron bloqueos reales');
    }
    
    // Tomar screenshot para verificar manualmente
    try {
      const timestamp = new Date().getTime();
      const screenshotPath = path.join(__dirname, 'debug', `test-page-${timestamp}.png`);
      if (!fs.existsSync(path.dirname(screenshotPath))) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      }
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot guardado: ${screenshotPath}`);
      console.log('👀 REVISA EL SCREENSHOT MANUALMENTE para confirmar que no hay bloqueo');
    } catch (e) {
      console.log('❌ No se pudo tomar screenshot');
    }
    
    // Buscar el texto de resultados para confirmar que funciona
    console.log('🔍 Buscando texto de conteo de productos...');
    
    try {
      // Esperar a que aparezca algún elemento específico de Amazon
      await page.waitForSelector('h2, .s-result-count, [data-component-type="s-result-info-bar"]', { timeout: 10000 });
      console.log('✅ Elementos de Amazon detectados');
      
      // Buscar específicamente el texto de resultados
      const h2Elements = await page.$$('h2');
      for (let i = 0; i < Math.min(h2Elements.length, 5); i++) {
        const text = await h2Elements[i].textContent();
        console.log(`📝 H2 ${i + 1}: "${text}"`);
        
        if (text && text.includes('resultado')) {
          console.log(`🎯 ¡ENCONTRADO! Texto de resultados: "${text}"`);
        }
      }
      
    } catch (e) {
      console.log('⚠️ No se pudieron encontrar elementos específicos de Amazon');
    }
    
    console.log('\n🎯 PASO 1: Probando captura de UNA subcategoría...');
    
    // Extraer las categorías principales
    console.log('🔍 Extrayendo categorías principales...');
    const mainCategories = await extractCategories(page);
    
    if (mainCategories.length === 0) {
      console.error('❌ No se encontraron categorías principales');
      return;
    }
    
    console.log(`✅ Encontradas ${mainCategories.length} categorías principales`);
    
    const processedCategories = [];
    
    // Procesar cada categoría principal una por una
    for (let i = 0; i < mainCategories.length; i++) {
      const category = mainCategories[i];
      console.log(`\n🚀 === PROCESANDO CATEGORÍA ${i + 1}/${mainCategories.length}: ${category.name} ===`);
      
      // Limpiar categorías para esta categoría principal
      leafCategories.length = 0;
      visitedUrls.clear();
      
      // Pausa antes de explorar cada categoría principal
      const pause = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos  
      console.log(`⏳ Pausa antes de explorar: ${pause / 1000}s`);
      await page.waitForTimeout(pause);
      
      // Explorar esta categoría principal
      await exploreCategory(page, category.url, category.name, 0);
      
      // Guardar resultados de esta categoría
      const filePath = saveCategoryResults(category.name, leafCategories);
      
      processedCategories.push({
        name: category.name,
        url: category.url,
        subcategories_count: leafCategories.length,
        file_path: filePath ? path.basename(filePath) : null,
        processed_at: new Date().toISOString()
      });
      
      console.log(`✅ Categoría completada: ${leafCategories.length} subcategorías encontradas`);
      
      // Pausa entre categorías principales
      if (i < mainCategories.length - 1) {
        const betweenPause = Math.floor(Math.random() * 5000) + 3000; // 3-8 segundos
        console.log(`⏸️ Pausa entre categorías: ${betweenPause / 1000}s`);
        await page.waitForTimeout(betweenPause);
      }
    }
    
    // Guardar resumen final
    saveSummaryResults(processedCategories);
    
    console.log('\n� RESULTADO DE LA PRUEBA:');
    console.log(`✅ Categorías válidas encontradas: ${leafCategories.length}`);
    console.log(`🔗 URLs visitadas: ${visitedUrls.size}`);
    
    if (leafCategories.length > 0) {
      console.log('\n🎯 Categorías encontradas:');
      leafCategories.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name}: ${cat.productCount} productos`);
      });
    }
    
    // Guardar lo que tenemos
    saveProgress();
    saveFinalResults();
    
    console.log('\n🛑 PRUEBA COMPLETADA - Solo exploró UNA categoría');
    console.log('💡 Si todo se ve bien, podemos continuar con más categorías');
    console.log(`📁 Revisa el archivo: ${OUTPUT_FILE}`);
    
    // Mantener navegador abierto para revisión
    console.log('⏳ Manteniendo navegador abierto 20 segundos para revisión...');
    await page.waitForTimeout(20000);
    
    return; // SALIR DESPUÉS DE UNA CATEGORÍA

  } catch (error) {
    console.error('❌ Error en la función principal:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    // Guardar progreso incluso si hay error
    saveProgress();
  } finally {
    try {
      await browser.close();
    } catch (e) {
      console.log('⚠️ Error cerrando navegador:', e.message);
    }
  }

  // Guardar progreso final
  saveProgress();

  // Guardar resultados
  console.log('\n📊 === RESUMEN FINAL ===');
  console.log(`✅ Total de categorías hoja encontradas: ${leafCategories.length}`);
  console.log(`🔗 URLs visitadas: ${visitedUrls.size}`);

  // Mostrar algunas estadísticas
  const validLeaves = leafCategories.filter(cat => cat.isLeaf && !cat.error);
  const forcedLeaves = leafCategories.filter(cat => !cat.isLeaf && !cat.error);
  const errorLeaves = leafCategories.filter(cat => cat.error);

  console.log(`📈 Categorías válidas (≤${MAX_PRODUCTS_PER_CATEGORY} productos): ${validLeaves.length}`);
  console.log(`🔒 Categorías forzadas (sin subcategorías): ${forcedLeaves.length}`);
  console.log(`❌ Categorías con errores: ${errorLeaves.length}`);

  // Guardar archivo JSON final
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(leafCategories, null, 2));
    console.log(`💾 Archivo final guardado: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error(`❌ Error guardando archivo final: ${error.message}`);
  }

  // Limpiar archivo de progreso temporal ya que terminamos
  try {
    const progressFile = path.join(__dirname, 'data', 'progress.json');
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
      console.log('🧹 Archivo de progreso temporal eliminado');
    }
  } catch (e) {
    console.log('⚠️ No se pudo eliminar archivo de progreso temporal');
  }

  // Mostrar algunas muestras
  if (validLeaves.length > 0) {
    console.log('\n📋 Algunas categorías válidas encontradas:');
    validLeaves.slice(0, 5).forEach(cat => {
      console.log(`  🎯 ${cat.name}: ${cat.productCount} productos`);
      console.log(`     ${cat.url}`);
    });
  }

  console.log('\n✅ Exploración completada!');
}

// Ejecutar el script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { main, exploreCategory, extractProductCount, extractCategories };