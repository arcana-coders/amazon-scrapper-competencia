# 📚 Documentación del Sistema

## 🎯 Empieza Aquí

### **MODELO-NEGOCIO.md** ⭐ PRIMERO
**Descripción completa del modelo de negocio y flujo del sistema.**  
Explica qué hacemos, por qué, y cómo funciona todo el proceso desde identificar un vendedor hasta publicar productos.

**Lee esto primero** antes que cualquier otra documentación.

---

## 📖 Guías por Rol

### 👤 Usuarios / Operadores
1. **MODELO-NEGOCIO.md** - Entender el negocio completo
2. **README-PANELMAESTRO-V2.md** - Guía de uso del panel
3. **CRITERIOS-VERIFICACION.md** - Estados de verificación + comandos

### 👨‍💻 Desarrolladores
1. **MODELO-NEGOCIO.md** - Entender el negocio
2. **FLUJO-OPORTUNIDADES.md** - Scripts y fórmulas técnicas
3. **CRITERIOS-VERIFICACION.md** - Lógica de verificación

---

## 📄 Documentos Disponibles

### 1. **MODELO-NEGOCIO.md** 🌟
**Modelo de negocio y flujo completo del sistema**

Contenido:
- Qué hacemos (dropshipping USA → MX)
- Por qué copiamos catálogos de competidores
- Flujo completo de 8 fases (con diagramas)
- Conceptos clave (ASIN, Buy Box, Snapshot, Batches)
- Ejemplo real con vendedor AE8MUNDUREHX7
- Preguntas frecuentes

**Duración**: 10 minutos de lectura  
**Impacto**: Te ahorrará horas de confusión

### 2. **README-PANELMAESTRO-V2.md**
**Guía completa de uso del panel principal**

Contenido:
- Arquitectura modular del sistema
- Descripción de cada menú (8 fases)
- Comandos y opciones disponibles
- Ejemplos de uso por fase
- Troubleshooting básico

**Para**: Operadores del sistema

### 3. **CRITERIOS-VERIFICACION.md**
**Estados de verificación y comandos**

Contenido:
- Definición de "producto verificado" (MX y USA)
- Lógica de `esPendiente()`
- Casos especiales
- Comandos rápidos de verificación
- Comandos de diagnóstico
- ⚠️ Verificación = snapshot único (NO se re-verifica)

**Para**: Operadores y desarrolladores

### 4. **FLUJO-OPORTUNIDADES.md**
**Scripts técnicos y fórmulas de análisis**

Contenido:
- Scripts de filtrado (prepare_business_csv.js)
- Scripts de análisis (buscando_productos_csv.js)
- Fórmulas de cálculo de precio sugerido
- Validaciones y criterios de filtrado
- Ejemplos con datos reales
- Estructura de archivos generados

**Para**: Desarrolladores

---

## 🚀 Quick Start

```bash
# 1. Leer modelo de negocio
docs/MODELO-NEGOCIO.md              # 10 minutos

# 2. Instalar y ejecutar
npm install
node MENU.js

# 3. Consultar guía según necesites
docs/README-PANELMAESTRO-V2.md      # Uso del panel
docs/CRITERIOS-VERIFICACION.md     # Verificación
```

---

## 📊 Jerarquía de Lectura

```
MODELO-NEGOCIO.md (PRIMERO)
    ↓
README-PANELMAESTRO-V2.md (Uso general)
    ↓
    ├─→ CRITERIOS-VERIFICACION.md (Fase 4-5)
    └─→ FLUJO-OPORTUNIDADES.md (Fase 6)
```

---

**Total documentos**: 4 documentos esenciales  
**Tiempo total de lectura**: ~30-40 minutos  
**Última actualización**: 28 de octubre de 2025


