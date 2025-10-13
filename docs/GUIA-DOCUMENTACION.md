# 📚 GUÍA DE DOCUMENTACIÓN DEL PROYECTO

> **Índice maestro de toda la documentación** - Actualizado: 13 de octubre de 2025

---

## 🎯 ¿POR DÓNDE EMPEZAR?

### **Si eres nuevo en el proyecto**:
1. 📖 Lee `README.md` (5 min) - Introducción y comandos básicos
2. 📋 Lee `DOCUMENTACION-MAESTRA.md` (30 min) - Guía completa del sistema
3. 🎮 Ejecuta `node PANELMAESTRO.js` - Interfaz interactiva

### **Si trabajas con vendedores grandes (2000+ productos)**:
1. 📦 Lee `GUIA-SISTEMA-INCREMENTAL.md` - Flujo de batches completo
2. ⭐ Lee `README-BATCH-INDIVIDUAL.md` - Procesamiento batch por batch
3. 🎮 Ejecuta `node PANELMAESTRO.js → [6] Sistema Incremental`

### **Si necesitas referencia técnica**:
- `DOCUMENTACION-MAESTRA.md` - Documento más completo y actualizado
- `README-IMPLEMENTACION-COMPLETA.md` - Detalles de implementación

---

## 📋 DOCUMENTOS PRINCIPALES

### **1. README.md** - Introducción al proyecto
**Propósito**: Primera lectura para nuevos usuarios  
**Contenido**:
- Qué hace el sistema (descripción general)
- Requisitos y setup inicial
- Comandos básicos para empezar
- Estructura de carpetas simplificada

**Cuándo leer**: Antes de usar el proyecto por primera vez  
**Tiempo de lectura**: 5 minutos

---

### **2. DOCUMENTACION-MAESTRA.md** ⭐ DOCUMENTO PRINCIPAL
**Propósito**: Guía completa y referencia de todo el sistema  
**Contenido**:
- Estado actual del proyecto (6 fases completadas)
- Descripción detallada de cada script
- Panel Maestro y todas sus opciones
- Sistema incremental por batches
- **NUEVO**: Procesamiento batch individual
- Flujos de trabajo recomendados
- Casos de uso documentados
- Tabla de decisión (qué método usar)
- Referencia rápida de comandos

**Cuándo leer**: Para entender el sistema completo  
**Tiempo de lectura**: 30-60 minutos (referencia continua)

**Secciones clave**:
- 🎮 Panel Maestro → Control central del sistema
- 📦 Sistema Incremental → Vendedores grandes
- ⭐ Procesamiento Batch Individual → NUEVO, procesamiento flexible
- 🚀 Flujos de Trabajo → Qué hacer según tamaño de vendedor
- 📊 Scripts por Fase → Descripción detallada de cada script

---

## 📦 SISTEMA DE BATCHES (Vendedores Grandes)

### **3. GUIA-SISTEMA-INCREMENTAL.md**
**Propósito**: Documentación completa del sistema de batches  
**Contenido**:
- ¿Qué es el sistema incremental?
- Flujo completo paso a paso
- Scripts principales:
  - `test-seller.js` - Registro de vendedores
  - `create-plan-batches.js` - División en lotes
  - `manage-batch-categories.js` - Gestión de categorías
  - `process-all-categories.js` - Procesamiento automático
- Ventajas del sistema
- Ejemplos con vendedores reales

**Cuándo leer**: Cuando trabajas con vendedores de 2000+ productos  
**Tiempo de lectura**: 20 minutos

**Relación con otros documentos**:
- Complementa `DOCUMENTACION-MAESTRA.md`
- Detalla la opción [6] del PANELMAESTRO
- Prerequisito para `README-BATCH-INDIVIDUAL.md`

---

### **4. README-BATCH-INDIVIDUAL.md** ⭐ NUEVO
**Propósito**: Sistema revolucionario de procesamiento batch por batch  
**Contenido**:
- Problema que resuelve (esperar 10 horas vs publicar en 2 horas)
- Scripts nuevos:
  - `process-single-batch.js` - Scraping de batch individual
  - `consolidate-batch-products.js` - Consolidación por batch
- Flujo de trabajo optimizado
- Comparación: workflow tradicional vs batch individual
- Archivos generados por batch
- Casos de uso reales

**Cuándo leer**: Cuando quieres flexibilidad máxima con vendedores grandes  
**Tiempo de lectura**: 15 minutos

**Ventaja clave**: Publica 1000 productos el primer día mientras sigues scrapeando otros batches

**Relación con otros documentos**:
- Evolución de `GUIA-SISTEMA-INCREMENTAL.md`
- Implementa la opción [6] → [3] del PANELMAESTRO
- Integrado en `DOCUMENTACION-MAESTRA.md`

---

### **5. CHANGELOG-INCREMENTAL.md**
**Propósito**: Historial de cambios del sistema incremental  
**Contenido**:
- Versiones y fechas
- Cambios implementados
- Bugs corregidos
- Mejoras agregadas

**Cuándo leer**: Para entender evolución del sistema de batches  
**Tiempo de lectura**: 5 minutos

---

### **6. README-IMPLEMENTACION-COMPLETA.md**
**Propósito**: Detalles técnicos de implementación del sistema incremental  
**Contenido**:
- Fases de implementación (4/4 completadas)
- Funciones agregadas a cada script
- Cambios en PANELMAESTRO
- Estado de integración

**Cuándo leer**: Para desarrollo o modificación del sistema  
**Tiempo de lectura**: 10 minutos

---

## 📖 DOCUMENTOS DE SOPORTE

### **7. categorias.md**
**Propósito**: Documentación de categorías de Amazon  
**Contenido**:
- Estructura de categorías
- Cómo funciona la navegación jerárquica
- Prevención de loops

**Cuándo leer**: Para entender el sistema de categorías de Amazon

---

### **8. GUIA-PRUEBA-SOLICITAR-PLANTILLA.md**
**Propósito**: Guía de pruebas para publicación (Fase 4)  
**Contenido**:
- Cómo probar solicitud de plantilla
- Cómo probar descarga de plantilla
- Validación del flujo completo

**Cuándo leer**: Al implementar o probar Fase 4

---

## 🗂️ ARCHIVOS DE DATOS

### **data/projects.json**
**Propósito**: Estado global de todos los vendedores  
**Contenido**: Fases completadas, batches, fechas, productos

### **data/vendors/SELLER_ID/**
**Propósito**: Datos específicos de cada vendedor  
**Contenido**:
- Planes de batches
- Productos consolidados
- Oportunidades filtradas
- Plantillas de publicación

---

## 🔄 RELACIÓN ENTRE DOCUMENTOS

```
README.md (Introducción)
    ↓
DOCUMENTACION-MAESTRA.md (Guía Completa) ⭐ DOCUMENTO CENTRAL
    ↓
    ├─→ GUIA-SISTEMA-INCREMENTAL.md (Batches completos)
    │       ↓
    │       └─→ README-BATCH-INDIVIDUAL.md (Batch por batch) ⭐ NUEVO
    │
    ├─→ README-IMPLEMENTACION-COMPLETA.md (Detalles técnicos)
    │
    ├─→ CHANGELOG-INCREMENTAL.md (Historial)
    │
    ├─→ categorias.md (Categorías Amazon)
    │
    └─→ GUIA-PRUEBA-SOLICITAR-PLANTILLA.md (Testing Fase 4)
```

---

## 🎯 FLUJO DE LECTURA RECOMENDADO

### **Para usuarios nuevos**:
```
1. README.md (5 min)
2. DOCUMENTACION-MAESTRA.md - Secciones:
   - Inicio Rápido (5 min)
   - Panel Maestro (10 min)
   - Flujos de Trabajo (5 min)
3. Ejecutar: node PANELMAESTRO.js
```

### **Para vendedores pequeños (< 1000 productos)**:
```
1. README.md (5 min)
2. DOCUMENTACION-MAESTRA.md - Secciones:
   - Fase 1: Scraping (10 min)
   - Fase 2-4: Flujo completo (15 min)
3. Ejecutar: node cerebro.js SELLER_ID
```

### **Para vendedores grandes (2000+ productos)**:
```
1. README.md (5 min)
2. DOCUMENTACION-MAESTRA.md - Secciones:
   - Panel Maestro → Opción [6] (5 min)
   - Sistema Incremental (10 min)
   - Procesamiento Batch Individual (10 min)
3. GUIA-SISTEMA-INCREMENTAL.md (20 min)
4. README-BATCH-INDIVIDUAL.md (15 min) ⭐
5. Ejecutar: node PANELMAESTRO.js → [6] → [3]
```

### **Para desarrolladores**:
```
1. DOCUMENTACION-MAESTRA.md (completo - 60 min)
2. README-IMPLEMENTACION-COMPLETA.md (10 min)
3. CHANGELOG-INCREMENTAL.md (5 min)
4. Revisar código de scripts específicos
```

---

## 📊 TABLA DE DOCUMENTOS POR CASO DE USO

| Caso de uso | Documentos necesarios | Orden |
|-------------|----------------------|-------|
| **Primer uso del sistema** | README.md, DOCUMENTACION-MAESTRA.md | 1, 2 |
| **Vendedor pequeño** | README.md, DOCUMENTACION-MAESTRA.md (Fases 1-4) | 1, 2 |
| **Vendedor mediano** | + GUIA-SISTEMA-INCREMENTAL.md | 1, 2, 3 |
| **Vendedor grande** | + README-BATCH-INDIVIDUAL.md | 1, 2, 3, 4 |
| **Desarrollo/Modificación** | Todos + código fuente | - |
| **Testing Fase 4** | DOCUMENTACION-MAESTRA.md + GUIA-PRUEBA-SOLICITAR-PLANTILLA.md | 2, 4 |

---

## 🆕 NOVEDADES (Octubre 2025)

### **13 de octubre: Sistema Batch Individual** ⭐
- **Nuevo documento**: `README-BATCH-INDIVIDUAL.md`
- **Nuevos scripts**: `process-single-batch.js`, `consolidate-batch-products.js`
- **Actualizado**: `DOCUMENTACION-MAESTRA.md` con sección completa
- **Ventaja**: Procesa y publica batch por batch en lugar de esperar a terminar todo

### **12 de octubre: Sistema Incremental**
- **Nuevo documento**: `GUIA-SISTEMA-INCREMENTAL.md`
- **Nuevos scripts**: `create-plan-batches.js`, `manage-batch-categories.js`
- **Actualizado**: `PANELMAESTRO.js` con opción [6]

---

## 🎯 PREGUNTAS FRECUENTES

### **¿Cuál es el documento más importante?**
`DOCUMENTACION-MAESTRA.md` - Es la guía completa y más actualizada.

### **¿Cuándo uso el sistema de batches?**
Cuando el vendedor tiene 2000+ productos. Lee `GUIA-SISTEMA-INCREMENTAL.md`.

### **¿Qué es el procesamiento batch individual?**
Sistema que permite procesar y publicar batch por batch. Lee `README-BATCH-INDIVIDUAL.md`.

### **¿Cómo sé qué método usar para mi vendedor?**
Consulta la "Tabla de Decisión" en `DOCUMENTACION-MAESTRA.md`.

### **¿Todos los documentos están actualizados?**
`DOCUMENTACION-MAESTRA.md` es el más actualizado (13 oct 2025). Los demás son complementarios.

---

## 📞 ACCESO RÁPIDO POR TEMA

### **Tema: Inicio y Setup**
→ `README.md`

### **Tema: Guía completa del sistema**
→ `DOCUMENTACION-MAESTRA.md` ⭐

### **Tema: Vendedores grandes**
→ `GUIA-SISTEMA-INCREMENTAL.md` + `README-BATCH-INDIVIDUAL.md`

### **Tema: Panel de control**
→ `DOCUMENTACION-MAESTRA.md` → Sección "Panel Maestro"

### **Tema: Publicación**
→ `DOCUMENTACION-MAESTRA.md` → Sección "Fase 4"

### **Tema: Desarrollo**
→ `README-IMPLEMENTACION-COMPLETA.md` + código fuente

---

## 🎉 CONCLUSIÓN

Este proyecto tiene documentación completa y bien organizada:

✅ **6 documentos principales** cubriendo todos los aspectos  
✅ **Guía de inicio rápido** para nuevos usuarios  
✅ **Documentación específica** para vendedores grandes  
✅ **Sistema revolucionario** de procesamiento batch individual  
✅ **Referencias técnicas** para desarrollo  

**Documento central**: `DOCUMENTACION-MAESTRA.md` (siempre actualizado)  
**Novedad**: `README-BATCH-INDIVIDUAL.md` (procesamiento flexible)

---

**Versión**: 1.0.0  
**Última actualización**: 13 de octubre de 2025  
**Autor**: Sistema de scraping Amazon MX
