const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 3) {
    console.log('❌ Uso: node create-plan.js SELLER_ID');
    console.log('📋 Ejemplo: node create-plan.js A3Q5ASRA7J8Y5E');
    process.exit(1);
}

const SELLER_ID = process.argv[2];
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

// Archivos y directorios - NUEVA ESTRUCTURA POR VENDEDOR
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
const PLAN_FILE = path.join(VENDOR_DIR, 'plan.json');

// Configuración para análisis recursivo
const MAX_PRODUCTS_PER_CATEGORY = 320; // Límite de Amazon
const MAX_RECURSION_DEPTH = 10; // Límite de seguridad anti-loops infinitos
const MAX_PRODUCTS_PER_BATCH = 1000; // Máximo productos por lote/plan

// Filtros para evitar elementos no deseados
const FILTER_PATTERNS = [
    /^\$[\d,.]+ a \$[\d,.]+$/,     // "$1,400 a $1,700"
    /^\$[\d,.]+ y más$/,           // "$5,000 y más"  
    /^Hasta \$[\d,.]+$/,           // "Hasta $1,000"
    /^\d+ Stars?\s*o más$/i,       // "4 Stars o más"
    /^Planes de Pago/i,            // "Planes de Pago Disponibles"
    /^Amazon (Estados Unidos|Europa|México)$/i, // Vendedores Amazon
    /^\w+ SHOP$/i,                 // "BRT SHOP"
    /^\d+$/,                       // "2", "3" (paginación)
    /^Siguiente$/i,                // "Siguiente" (paginación)
    /^Anterior$/i,                 // "Anterior" (paginación) 
    /^Incluir no Disponibles$/i,   // "Incluir no Disponibles"
    /^[A-Z\s]+ [A-Z]{2,}$/         // "LIE LIN", "FERRETERIA BE" (marcas)
];

// Crear carpeta del vendedor si no existe
if (!fs.existsSync(VENDOR_DIR)) {
    fs.mkdirSync(VENDOR_DIR, { recursive: true });
    console.log(`📁 Carpeta creada para vendedor: ${VENDOR_DIR}`);
}

/**
 * Verifica si una categoría es válida (no es filtro ni loop)
 */
function isValidCategory(name, currentPath = [], mainCategories = new Set()) {
    if (!name || name.trim().length === 0) return false;

    const cleanName = name.trim();

    // Evitar loops: categorías principales como subcategorías
    if (mainCategories.size > 0 && mainCategories.has(cleanName)) {
        console.log(`      🚫 LOOP EVITADO: "${cleanName}" (categoría principal)`);
        return false;
    }

    // Evitar loops circulares: categoría ya en el path actual
    if (currentPath.includes(cleanName)) {
        console.log(`      🚫 LOOP CIRCULAR EVITADO: "${cleanName}"`);
        return false;
    }

    // Evitar filtros conocidos
    for (const pattern of FILTER_PATTERNS) {
        if (pattern.test(cleanName)) {
            console.log(`      🚫 FILTRO EVITADO: "${cleanName}"`);
            return false;
        }
    }

    return true;
}

/**
 * Extrae el conteo de productos de la página actual
 */
async function extractProductCount(page, categoryName) {
    try {
        console.log(`      📊 Extrayendo conteo de: ${categoryName}`);

        const selectors = [
            'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
            '.s-desktop-width-max .a-section h1',
            '[data-component-type="s-search-result"] h2',
            '.s-size-small.s-color-secondary'
        ];

        for (const selector of selectors) {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const text = await element.textContent();
                if (text && text.includes('resultado')) {
                    console.log(`         ✅ Texto: "${text}"`);

                    const patterns = [
                        /1-\d+\s+de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
                        /(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
                        /más de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i
                    ];

                    for (const pattern of patterns) {
                        const match = text.match(pattern);
                        if (match) {
                            const count = parseInt(match[1].replace(/,/g, ''));
                            console.log(`         🎯 Productos detectados: ${count}`);
                            return count;
                        }
                    }
                }
            }
        }

        console.log(`         ⚠️ No se pudo extraer conteo`);
        return null;

    } catch (error) {
        console.log(`         ❌ Error extrayendo conteo: ${error.message}`);
        return null;
    }
}

/**
 * Extrae subcategorías de la página actual
 */
async function extractSubcategories(page, currentPath = [], mainCategories = new Set()) {
    try {
        const subcategories = await page.evaluate((sellerId) => {
            const results = [];
            const selectors = [
                'div[data-cy="nav-subnav"] a',
                '#s-refinements a[href*="rh=n"]',
                '.s-navigation-item a[href*="rh=n"]',
                '#leftNav a[href*="rh=n"]'
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const href = element.getAttribute('href');
                    const text = element.textContent?.trim();

                    if (href && text && href.includes(sellerId)) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
                        results.push({ name: text, url: fullUrl });
                    }
                }
            }

            return results;
        }, SELLER_ID);

        // Filtrar subcategorías válidas
        const validSubcategories = [];
        let loopsDetected = 0;
        let filtersDetected = 0;

        for (const subcat of subcategories) {
            if (isValidCategory(subcat.name, currentPath, mainCategories)) {
                validSubcategories.push(subcat);
            } else {
                const cleanName = subcat.name.trim();
                if (mainCategories.has(cleanName) || currentPath.includes(cleanName)) {
                    loopsDetected++;
                } else {
                    filtersDetected++;
                }
            }
        }

        console.log(`      🔍 Subcategorías encontradas: ${subcategories.length} total`);
        console.log(`      ✅ Válidas: ${validSubcategories.length}`);
        if (loopsDetected > 0) console.log(`      🚫 Loops evitados: ${loopsDetected}`);
        if (filtersDetected > 0) console.log(`      🚫 Filtros evitados: ${filtersDetected}`);

        return {
            valid: validSubcategories.slice(0, 15), // Máximo 15 por nivel
            stats: { total: subcategories.length, loops: loopsDetected, filters: filtersDetected }
        };

    } catch (error) {
        console.log(`      ❌ Error extrayendo subcategorías: ${error.message}`);
        return { valid: [], stats: { total: 0, loops: 0, filters: 0 } };
    }
}

/**
 * Analiza una categoría recursivamente durante la creación del plan
 */
async function analyzeRecursively(page, category, mainCategories, depth = 1, path = []) {
    console.log(`${'  '.repeat(depth)}📂 Analizando: ${category.name} (profundidad: ${depth})`);

    // Límite de seguridad para evitar recursión infinita
    if (depth > MAX_RECURSION_DEPTH) {
        console.log(`${'  '.repeat(depth)}⚠️ Límite de profundidad alcanzado (${MAX_RECURSION_DEPTH})`);
        return null;
    }

    try {
        // Navegar a la categoría
        console.log(`${'  '.repeat(depth)}🔍 Navegando...`);
        await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Extraer conteo de productos
        const productCount = await extractProductCount(page, category.name);

        if (productCount === null) {
            console.log(`${'  '.repeat(depth)}⚠️ No se pudo determinar productos, saltando...`);
            return null;
        }

        console.log(`${'  '.repeat(depth)}📊 Productos: ${productCount}`);

        // Si tiene pocos productos, es una hoja
        if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
            console.log(`${'  '.repeat(depth)}✅ HOJA (${productCount} ≤ ${MAX_PRODUCTS_PER_CATEGORY})`);
            return {
                name: category.name,
                url: category.url,
                expected_products: productCount,
                isLeaf: true,
                depth: depth,
                path: [...path, category.name],
                status: 'pending',
                created_at: new Date().toISOString()
            };
        }

        // Necesita subdivisión
        console.log(`${'  '.repeat(depth)}🌳 NECESITA SUBDIVISIÓN (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY})`);

        // Extraer subcategorías
        const subcatResult = await extractSubcategories(page, [...path, category.name], mainCategories);

        if (subcatResult.valid.length === 0) {
            console.log(`${'  '.repeat(depth)}⚠️ Sin subcategorías válidas, guardando como hoja`);
            return {
                name: category.name,
                url: category.url,
                expected_products: productCount,
                isLeaf: true,
                depth: depth,
                path: [...path, category.name],
                status: 'pending',
                created_at: new Date().toISOString(),
                note: 'No subcategories found - saved as leaf'
            };
        }

        // Analizar subcategorías recursivamente
        console.log(`${'  '.repeat(depth)}🔄 Analizando ${subcatResult.valid.length} subcategorías...`);
        const subcategoriesAnalysis = [];

        for (const subcat of subcatResult.valid) {
            const analysis = await analyzeRecursively(page, subcat, mainCategories, depth + 1, [...path, category.name]);
            if (analysis) {
                subcategoriesAnalysis.push(analysis);
            }
        }

        return {
            name: category.name,
            url: category.url,
            expected_products: productCount,
            isLeaf: false,
            depth: depth,
            path: [...path, category.name],
            status: 'pending',
            subcategories: subcategoriesAnalysis,
            created_at: new Date().toISOString()
        };

    } catch (error) {
        console.log(`${'  '.repeat(depth)}❌ Error: ${error.message}`);
        return null;
    }
}

/**
 * Carga las cookies de autenticación
 */
function loadCookies() {
    try {
        if (!fs.existsSync(COOKIES_FILE)) {
            console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE);
            console.log('🔑 Ejecuta primero: node scripts/a-login.js');
            return null;
        }

        const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

        if (!cookieData.cookies || !Array.isArray(cookieData.cookies)) {
            console.error('❌ Formato de cookies inválido');
            return null;
        }

        console.log(`✅ Cookies cargadas: ${cookieData.cookies.length}`);
        return cookieData.cookies;
    } catch (error) {
        console.error('❌ Error cargando cookies:', error.message);
        return null;
    }
}

/**
 * Detecta batches ya creados y última categoría procesada
 */
function detectExistingBatches() {
    if (!fs.existsSync(VENDOR_DIR)) {
        return { lastBatch: 0, processedCategories: [] };
    }

    const files = fs.readdirSync(VENDOR_DIR);
    const batchFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}-plan-batch-\d+\.json$/));

    if (batchFiles.length === 0) {
        return { lastBatch: 0, processedCategories: [] };
    }

    // Ordenar por número de batch
    batchFiles.sort((a, b) => {
        const numA = parseInt(a.match(/batch-(\d+)\.json$/)[1]);
        const numB = parseInt(b.match(/batch-(\d+)\.json$/)[1]);
        return numA - numB;
    });

    const lastBatchFile = batchFiles[batchFiles.length - 1];
    const lastBatchNum = parseInt(lastBatchFile.match(/batch-(\d+)\.json$/)[1]);

    console.log(`✅ Detectados ${batchFiles.length} batch(es) existente(s)`);

    // Leer todas las categorías procesadas
    const processedCategories = [];
    for (const batchFile of batchFiles) {
        try {
            const batchData = JSON.parse(fs.readFileSync(path.join(VENDOR_DIR, batchFile), 'utf8'));
            if (batchData.categories && Array.isArray(batchData.categories)) {
                batchData.categories.forEach(cat => {
                    if (cat.name) processedCategories.push(cat.name);
                });
            }
        } catch (error) {
            console.log(`⚠️  Error leyendo ${batchFile}`);
        }
    }

    console.log(`📂 Categorías ya procesadas: ${processedCategories.length}`);

    return { lastBatch: lastBatchNum, processedCategories };
}

/**
 * Contar hojas y mostrar resumen
 */
function countLeaves(categories) {
    let totalLeaves = 0;
    let totalProducts = 0;

    for (const cat of categories) {
        if (cat.isLeaf) {
            totalLeaves++;
            totalProducts += cat.expected_products || 0;
        } else if (cat.subcategories) {
            const subResult = countLeaves(cat.subcategories);
            totalLeaves += subResult.leaves;
            totalProducts += subResult.products;
        }
    }

    return { leaves: totalLeaves, products: totalProducts };
}

/**
 * Crea un plan completo para el vendedor
 */
async function createCompletePlan() {
    console.log('📋 === CREADOR DE PLAN POR LOTES ===');
    console.log(`🎯 Vendedor: ${SELLER_ID}`);
    console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);

    // Detectar batches existentes
    const { lastBatch, processedCategories } = detectExistingBatches();

    if (lastBatch > 0) {
        console.log(`\n♻️  REANUDANDO desde batch ${lastBatch + 1}`);
        console.log(`⏭️  Saltando ${processedCategories.length} categorías ya procesadas`);
    }

    // Cargar cookies
    const cookies = loadCookies();
    if (!cookies) return;

    console.log('\n🚀 Iniciando navegador...');
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1366, height: 768 }
    });

    await context.addCookies(cookies);
    const page = await context.newPage();

    try {
        console.log('🔍 Navegando al vendedor...');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Extraer categorías principales
        console.log('📂 Extrayendo categorías principales...');
        const categorySelectors = [
            '#s-refinements a[href*="rh=n"]',
            '.s-navigation-item a[href*="rh=n"]',
            '#leftNav a[href*="rh=n"]',
            '.a-link-normal[href*="rh=n"]'
        ];

        let categories = [];
        for (const selector of categorySelectors) {
            const elements = await page.$$(selector);

            for (const element of elements) {
                try {
                    const href = await element.getAttribute('href');
                    const text = await element.textContent();
                    const trimmedText = text ? text.trim() : '';

                    if (href && trimmedText && href.includes('rh=n') && href.includes(SELLER_ID)) {
                        const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
                        categories.push({
                            name: trimmedText,
                            url: fullUrl
                        });
                    }
                } catch (e) {
                    // Continuar
                }
            }

            if (categories.length > 0) break;
        }

        // Eliminar duplicados
        const uniqueCategories = categories.filter((cat, index, self) =>
            index === self.findIndex(c => c.name === cat.name)
        );

        console.log(`✅ Encontradas ${uniqueCategories.length} categorías principales`);

        // Si no hay categorías, usar la URL base como "Todo"
        if (uniqueCategories.length === 0) {
            console.log('⚠️ No se encontraron categorías. Usando URL base como categoría única.');
            uniqueCategories.push({
                name: 'All Products',
                url: BASE_URL
            });
        }

        // Crear Set de categorías principales para filtrado
        const mainCategories = new Set(uniqueCategories.map(cat => cat.name));

        // Crear plan base con análisis recursivo
        const plan = {
            seller_id: SELLER_ID,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            total_main_categories: uniqueCategories.length,
            main_categories: Array.from(mainCategories),
            analysis_type: 'recursive_hierarchical',
            max_products_per_leaf: MAX_PRODUCTS_PER_CATEGORY,
            max_recursion_depth: MAX_RECURSION_DEPTH,
            categories: []
        };

        console.log('\n🧠 === ANÁLISIS RECURSIVO JERÁRQUICO ===');
        console.log(`📊 Límite por categoría hoja: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
        console.log(`🔄 Profundidad máxima: ${MAX_RECURSION_DEPTH} niveles`);
        console.log(`🛡️ Filtro anti-loops: ${mainCategories.size} categorías principales`);

        // Analizar cada categoría principal recursivamente
        for (let i = 0; i < uniqueCategories.length; i++) {
            const category = uniqueCategories[i];
            console.log(`\n🎯 === ANALIZANDO CATEGORÍA ${i + 1}/${uniqueCategories.length}: ${category.name} ===`);

            const analysis = await analyzeRecursively(page, category, mainCategories, 1, []);

            if (analysis) {
                plan.categories.push(analysis);
                console.log(`✅ ${category.name} analizada exitosamente`);
            } else {
                console.log(`❌ ${category.name} falló en el análisis`);
                // Agregar categoría con error para no perderla
                plan.categories.push({
                    name: category.name,
                    url: category.url,
                    expected_products: null,
                    isLeaf: true,
                    depth: 1,
                    path: [category.name],
                    status: 'error',
                    error_during_creation: 'Analysis failed',
                    created_at: new Date().toISOString()
                });
            }
        }

        // Guardar plan jerárquico
        console.log('\n💾 Guardando plan jerárquico...');
        fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));

        console.log('\n🎉 === PLAN JERÁRQUICO COMPLETO ===');
        console.log(`📊 Tipo de análisis: ${plan.analysis_type}`);
        console.log(`📂 Categorías principales: ${plan.total_main_categories}`);
        console.log(`🍂 Límite por hoja: ${plan.max_products_per_leaf} productos`);

        const summary = countLeaves(plan.categories);

        console.log(`\n📊 RESUMEN DEL ANÁLISIS JERÁRQUICO:`);
        console.log(`🍂 Total categorías hoja: ${summary.leaves}`);
        console.log(` Total productos estimados: ${summary.products}`);
        console.log(`💾 Plan guardado en: ${path.basename(PLAN_FILE)}`);
        console.log(`\n🚀 Listo para scraping con:`);
        console.log(`   node cerebro.js ${SELLER_ID}`);

    } catch (error) {
        console.error('❌ Error creando plan:', error.message);
    } finally {
        await browser.close();
    }
}

// Ejecutar
if (require.main === module) {
    createCompletePlan().catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { createCompletePlan };
