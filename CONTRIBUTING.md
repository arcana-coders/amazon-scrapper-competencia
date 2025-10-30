# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir al proyecto **Amazon Scraper System**!

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [¿Cómo puedo contribuir?](#cómo-puedo-contribuir)
- [Configuración del entorno](#configuración-del-entorno)
- [Guía de estilo](#guía-de-estilo)
- [Proceso de Pull Request](#proceso-de-pull-request)
- [Reportar bugs](#reportar-bugs)
- [Sugerir mejoras](#sugerir-mejoras)

---

## 📜 Código de Conducta

Este proyecto se adhiere a un código de conducta. Al participar, se espera que mantengas este código. Por favor reporta comportamientos inaceptables.

---

## 🎯 ¿Cómo puedo contribuir?

### 1. Implementar módulos pendientes

Los siguientes módulos están como stubs y necesitan implementación:

- [ ] `modules/menu-verificacion-usa.js` - Verificación de productos en Amazon USA
- [ ] `modules/menu-oportunidades.js` - Generación de oportunidades de negocio
- [ ] `modules/menu-plantillas.js` - Gestión de plantillas Seller Central
- [ ] `modules/menu-publicacion.js` - Publicación de productos
- [ ] `modules/menu-reportes.js` - Sistema de reportes

**Patrón a seguir**: Ver `modules/menu-vendedores.js` como referencia completa.

### 2. Mejorar la documentación

- Agregar ejemplos de uso
- Traducir documentación al inglés
- Crear tutoriales en video
- Mejorar diagramas y visualizaciones

### 3. Reportar y corregir bugs

- Revisar [Issues](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues)
- Reportar nuevos bugs con detalles
- Corregir bugs existentes

### 4. Proponer nuevas funcionalidades

- Notificaciones por Telegram/Email
- Interfaz web con React/Next.js
- API REST
- Sistema de alertas de precios
- Multi-marketplace support

---

## ⚙️ Configuración del entorno

### Prerrequisitos

```bash
node --version  # 16+
npm --version
git --version
```

### Fork y Clone

```bash
# 1. Fork el repositorio en GitHub

# 2. Clonar tu fork
git clone https://github.com/TU-USUARIO/amazon-scrapper-otherseller.git
cd amazon-scrapper-otherseller

# 3. Agregar upstream
git remote add upstream https://github.com/ORIGINAL-USUARIO/amazon-scrapper-otherseller.git

# 4. Instalar dependencias
npm install

# 5. Instalar navegadores
npx playwright install
```

### Crear rama de trabajo

```bash
# Siempre crear rama desde main actualizado
git checkout main
git pull upstream main

# Crear nueva rama
git checkout -b feature/nombre-funcionalidad
# o
git checkout -b fix/nombre-bug
```

---

## 🎨 Guía de estilo

### JavaScript

Seguimos las convenciones de Node.js y JavaScript moderno:

```javascript
// ✅ BIEN: Usar async/await
async function extraerProductos(sellerId) {
  const productos = await obtenerDatos(sellerId);
  return productos;
}

// ❌ EVITAR: Callbacks anidados
function extraerProductos(sellerId, callback) {
  obtenerDatos(sellerId, function(error, productos) {
    // ...
  });
}

// ✅ BIEN: Destructuring
const { showTitle, showError } = require('./utils/display-utils');

// ✅ BIEN: Template literals
await typewriteLine(`Procesando vendedor: ${sellerId}`);

// ✅ BIEN: Nombres descriptivos
const vendorsWithBatchPlans = [];

// ❌ EVITAR: Nombres genéricos
const arr = [];
const data = {};
```

### Estructura de módulos

Todos los módulos de menú deben seguir este patrón:

```javascript
/**
 * MÓDULO: NOMBRE DEL MÓDULO
 * Descripción breve
 */

// 1. Imports
const { typewriteLine, ask, showTitle } = require('./utils/display-utils');
const { loadProjects } = require('./utils/projects-utils');

// 2. Funciones auxiliares
async function funcionAuxiliar(rl) {
  // Lógica...
}

// 3. Función principal exportada
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    // Mostrar menú
    await showTitle('MI MÓDULO', { icon: '🎯' });
    await typewriteLine('[1] Opción 1');
    await typewriteLine('[0] ← Volver');
    
    const option = await ask('Selecciona: ', rl);
    
    switch (option) {
      case '1':
        await funcionAuxiliar(rl);
        break;
      case '0':
        continuar = false;
        break;
      default:
        await showWarning('Opción inválida');
    }
  }
}

// 4. Export
module.exports = { show };
```

### Comentarios

```javascript
// ✅ BIEN: Comentarios que explican el "por qué"
// Amazon limita a 320 productos por URL, extraemos por subcategorías
const maxProductsPorUrl = 320;

// ✅ BIEN: JSDoc para funciones públicas
/**
 * Extrae productos de un batch específico
 * @param {string} sellerId - ID del vendedor
 * @param {number} batchNum - Número del batch
 * @returns {Promise<Array>} Productos extraídos
 */
async function extractBatch(sellerId, batchNum) {
  // ...
}

// ❌ EVITAR: Comentarios obvios
// Incrementar contador
contador++;
```

### Manejo de errores

```javascript
// ✅ BIEN: Try-catch con mensajes descriptivos
try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data;
} catch (error) {
  await showError(`Error al leer ${filePath}: ${error.message}`);
  return null;
}

// ✅ BIEN: Validación de entrada
if (!sellerId || typeof sellerId !== 'string') {
  await showError('Seller ID inválido');
  return;
}
```

---

## 🔄 Proceso de Pull Request

### Antes de crear el PR

1. **Actualizar tu rama**:
   ```bash
   git checkout main
   git pull upstream main
   git checkout tu-rama
   git rebase main
   ```

2. **Probar tu código**:
   ```bash
   # Ejecutar el sistema
   node MENU.js
   
   # Probar tu módulo específico
   # Verificar que no hay errores
   ```

3. **Verificar archivos**:
   ```bash
   git status
   # No incluir data/, auth/, node_modules/
   ```

### Crear el PR

1. **Push a tu fork**:
   ```bash
   git push origin tu-rama
   ```

2. **Abrir PR en GitHub**:
   - Ir a tu fork en GitHub
   - Click en "Pull Request"
   - Seleccionar tu rama
   - Llenar el template

### Template de PR

```markdown
## Descripción
Breve descripción de los cambios

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Mejora de funcionalidad existente
- [ ] Documentación
- [ ] Refactoring

## ¿Cómo probar?
1. Paso 1
2. Paso 2
3. ...

## Checklist
- [ ] Mi código sigue el estilo del proyecto
- [ ] He probado mi código localmente
- [ ] He actualizado la documentación
- [ ] No hay warnings/errors en consola
- [ ] He agregado comentarios en código complejo

## Screenshots (si aplica)
```

---

## 🐛 Reportar bugs

### Antes de reportar

1. Busca si el bug ya fue reportado
2. Verifica que no sea un problema de configuración local
3. Prueba con la última versión del código

### Template de bug report

```markdown
**Descripción del bug**
Descripción clara del problema

**Para reproducir**
1. Ir a '...'
2. Click en '...'
3. Ingresar '...'
4. Ver error

**Comportamiento esperado**
Qué debería pasar

**Comportamiento actual**
Qué está pasando

**Screenshots**
Si aplica, agrega screenshots

**Entorno**
- OS: [Windows 11, macOS, Linux]
- Node.js: [v16.x.x]
- Navegador Playwright: [Chromium/Firefox/WebKit]

**Logs/Errores**
```
Pega aquí los logs del error
```

**Contexto adicional**
Cualquier información relevante
```

---

## 💡 Sugerir mejoras

### Template de feature request

```markdown
**¿El feature está relacionado con un problema?**
Descripción del problema

**Solución propuesta**
Descripción clara de lo que quieres que pase

**Alternativas consideradas**
Otras soluciones que consideraste

**Contexto adicional**
Screenshots, diagramas, ejemplos de código
```

---

## 📚 Recursos útiles

### Documentación del proyecto
- [INDICE-DOCUMENTACION.md](docs/INDICE-DOCUMENTACION.md) - Índice completo
- [README-PANELMAESTRO-V2.md](docs/README-PANELMAESTRO-V2.md) - Arquitectura modular
- [RESUMEN-IMPLEMENTACION.md](docs/RESUMEN-IMPLEMENTACION.md) - Estado del proyecto

### Tecnologías
- [Node.js Docs](https://nodejs.org/docs/)
- [Playwright Docs](https://playwright.dev/)
- [JavaScript MDN](https://developer.mozilla.org/es/docs/Web/JavaScript)

### Ejemplos de código
- `modules/menu-vendedores.js` - Módulo completo de referencia
- `modules/utils/` - Utilidades reutilizables

---

## ✅ Checklist del colaborador

Antes de enviar tu contribución, verifica:

- [ ] He leído la guía de contribución
- [ ] Mi código sigue el estilo del proyecto
- [ ] He probado mi código localmente
- [ ] He actualizado la documentación si es necesario
- [ ] Mis commits tienen mensajes descriptivos
- [ ] He creado una rama específica para mi cambio
- [ ] Mi PR tiene una descripción clara
- [ ] No hay conflictos con la rama main

---

## 🎉 ¡Gracias por contribuir!

Tu contribución es valiosa y ayuda a mejorar el proyecto para todos.

Si tienes dudas:
- Revisa la [documentación](docs/)
- Abre un [Issue](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues)
- Pregunta en el PR

---

**Happy Coding! 🚀**
