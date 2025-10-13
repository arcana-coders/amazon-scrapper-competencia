Objetivo:
Desarrollar un script en Node.js usando Playwright que explore recursivamente la estructura de categorías y subcategorías de una tienda específica en Amazon México, con el fin de identificar y guardar todos los enlaces de navegación cuyo número total de productos sea menor o igual a 320 (es decir, ≤20 páginas × 16 productos/página).

Contexto:

La tienda tiene más de 60,000 productos, pero Amazon solo permite navegar hasta la página 20 (≈320 productos por categoría).
Para scrapear todos los productos, necesitamos desglosar las categorías en subcategorías hasta que cada nodo final tenga ≤320 productos.
El script NO debe scrapear productos todavía, solo debe mapear la jerarquía de categorías/subcategorías y registrar:
URL de la categoría/subcategoría
Número estimado de resultados (productos)
Indicador de si es una "hoja" (≤320 productos)
Comportamiento esperado:

Iniciar desde la URL principal de la tienda:
https://www.amazon.com.mx/s?me=A1VKD22N1RQ0B&marketplaceID=A1AM78C64UM0Y8
Extraer todas las categorías principales visibles en el sidebar izquierdo (bajo "Departamentos").
Para cada categoría:
Ir a su URL.
Esperar a que la página cargue completamente (usar page.waitForLoadState('networkidle') o esperar a que aparezcan elementos clave como el conteo de resultados o el sidebar).
Extraer el número total de resultados (usualmente aparece como texto tipo "1-16 de más de 1,000 resultados" o "1-16 de 245 resultados").
Si el texto dice "más de X", asumir que X > 320 y continuar subdividiendo.
Si el número es ≤320, guardar esa URL como "hoja final" (lista para scraping posterior).
Si el número >320, extraer todas las subcategorías del sidebar y repetir el proceso recursivamente.
Evitar bucles infinitos: llevar un registro de URLs ya visitadas y no procesarlas de nuevo.
Simular comportamiento humano:
Entre cada navegación (de una página a otra), esperar un tiempo aleatorio entre 2 y 6 segundos (Math.floor(Math.random() * 4000) + 2000).
Usar page.goto() con opción { waitUntil: 'networkidle' }.
Considerar usar un user-agent realista y, si es posible, una ventana con dimensiones típicas de escritorio.
Evitar patrones repetitivos: no hacer clicks ni acciones en el mismo milisegundo siempre.
Guardar el resultado en un archivo categories.json con una estructura plana de URLs hoja:
json


1
2
3
4
5
6
7
8
9
10
11
12
⌄
⌄
⌄
[
  {
    "url": "https://www.amazon.com.mx/s?i=merchant-items&me=...&rh=n%3A17724549011",
    "productCount": 245,
    "isLeaf": true
  },
  {
    "url": "https://www.amazon.com.mx/s?i=merchant-items&me=...&rh=n%3A17800000000",
    "productCount": 180,
    "isLeaf": true
  }
]
Requisitos técnicos:

Usar Playwright con Chromium en modo headless: true (a menos que se esté depurando).
Detectar el conteo de productos usando selectores robustos (por ejemplo: [cel_widget_id*='RESULT_INFO_BAR'], .s-pagination-item, o texto en h1 o span cercano al encabezado de resultados).
Manejar errores con logging claro (timeout, captcha, bloqueo, página no disponible) y continuar con la siguiente categoría si falla una.
Respetar la estabilidad del sitio: no hacer scraping agresivo. El enfoque es lento, seguro y sostenible.
Ejemplos de URLs útiles:

Tienda principal:
https://www.amazon.com.mx/s?me=A1VKD22N1RQ0B&marketplaceID=A1AM78C64UM0Y8
Categoría principal:
https://www.amazon.com.mx/s?i=merchant-items&me=A1VKD22N1RQ0B&rh=n%3A17608484011&dc&ds=v1%3AMPr3m98pU1lUHdadldPPs%2BOHtBw2U5DeDZlaFFHGpwk&marketplaceID=A1AM78C64UM0Y8&qid=1759984453&rnid=15997893011&ref=sr_nr_n_1
Subcategoría:
https://www.amazon.com.mx/s?i=merchant-items&me=A1VKD22N1RQ0B&rh=n%3A17608484011%2Cn%3A17724549011&dc&ds=v1%3AbyqKvoMzFCbjtRmgOxAb2Djs2Lup5IX%2FyBRiNb5hViU&marketplaceID=A1AM78C64UM0Y8&qid=1759984498&rnid=17608484011&ref=sr_nr_n_1
Entregable:
Un script ejecutable llamado category-explorer.js que:

Navega de forma recursiva y segura por categorías/subcategorías.
Usa tiempos de espera aleatorios y espera a carga completa.
Genera un archivo categories.json con todas las URLs hoja (≤320 productos).