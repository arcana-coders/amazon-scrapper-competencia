const fs = require('fs');
const config = require('../config/pipeline-config');

class PipelineManager {
  constructor() {
    this.statePath = config.paths.state;
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      }
    } catch (error) {
      console.error('Error cargando estado:', error.message);
    }
    return this.getInitialState();
  }

  getInitialState() {
    return {
      activo: false,
      pausado: false,
      vendedorActual: null,
      faseActual: null,
      iniciado: null,
      ultimaActividad: null,
      estadisticas: {
        vendedoresProcesados: 0,
        vendedoresConError: 0,
        tiempoTotal: 0
      },
      cola: [],
      historial: []
    };
  }

  async saveState() {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Error guardando estado:', error.message);
    }
  }

  async agregarVendedor(vendedorId, fases = ['plan', 'scraping', 'verificar_mx', 'verificar_usa', 'oportunidades']) {
    const existe = this.state.cola.find(v => v.vendedorId === vendedorId);
    if (existe) {
      throw new Error(`Vendedor ${vendedorId} ya está en la cola.`);
    }

    const nuevoItem = {
      vendedorId,
      fases,
      fasesCompletadas: [],
      estado: 'pendiente',
      agregado: new Date().toISOString(),
      iniciado: null,
      completado: null,
      error: null,
      intentos: 0,
      progreso: {
        faseActual: null,
        batchActual: null,
        totalBatches: null,
        productosActual: null,
        totalProductos: null
      }
    };

    this.state.cola.push(nuevoItem);
    await this.saveState();
    return nuevoItem;
  }

  async removerVendedor(vendedorId) {
    this.state.cola = this.state.cola.filter(v => v.vendedorId !== vendedorId);
    await this.saveState();
  }

  async actualizarProgreso(vendedorId, datosProgreso) {
    const vendedor = this.state.cola.find(v => v.vendedorId === vendedorId);
    if (vendedor) {
      vendedor.progreso = { ...vendedor.progreso, ...datosProgreso };
      vendedor.ultimaActividad = new Date().toISOString();
      this.state.ultimaActividad = new Date().toISOString();
      await this.saveState();
    }
  }

  async marcarFaseCompletada(vendedorId, fase) {
    const vendedor = this.state.cola.find(v => v.vendedorId === vendedorId);
    if (vendedor) {
      if (!vendedor.fasesCompletadas.includes(fase)) {
        vendedor.fasesCompletadas.push(fase);
      }
      await this.saveState();
    }
  }

  async moverAHistorial(vendedorId, estadoFinal = 'completado', error = null) {
    const index = this.state.cola.findIndex(v => v.vendedorId === vendedorId);
    if (index !== -1) {
      const vendedor = this.state.cola[index];
      this.state.cola.splice(index, 1);
      
      vendedor.estado = estadoFinal;
      vendedor.completado = new Date().toISOString();
      vendedor.error = error;
      
      this.state.historial.unshift(vendedor);
      // Limitar historial a últimos 50
      if (this.state.historial.length > 50) {
        this.state.historial.pop();
      }

      if (estadoFinal === 'completado') {
        this.state.estadisticas.vendedoresProcesados++;
      } else {
        this.state.estadisticas.vendedoresConError++;
      }
      
      await this.saveState();
    }
  }
  
  getSiguienteVendedor() {
      return this.state.cola.length > 0 ? this.state.cola[0] : null;
  }
}

module.exports = new PipelineManager();
