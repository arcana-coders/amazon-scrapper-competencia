const fs = require('fs');
const path = require('path');
const config = require('../config/pipeline-config');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', '..', 'logs', 'pipeline');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatLogEntry(level, message, data = null) {
    let entry = `[${this.getTimestamp()}] [${level}] ${message}`;
    if (data) {
      entry += ` | ${JSON.stringify(data)}`;
    }
    return entry;
  }

  writeToFile(filename, content) {
    try {
      const filepath = path.join(this.logsDir, filename);
      fs.appendFileSync(filepath, content + '\n', 'utf8');
    } catch (error) {
      console.error('Error escribiendo log:', error.message);
    }
  }

  log(message, data = null) {
    const entry = this.formatLogEntry('INFO', message, data);
    const filename = `pipeline-${this.getDateString()}.log`;
    this.writeToFile(filename, entry);
  }

  error(message, error = null) {
    const data = error ? { error: error.message, stack: error.stack } : null;
    const entry = this.formatLogEntry('ERROR', message, data);
    const filename = `pipeline-${this.getDateString()}.log`;
    this.writeToFile(filename, entry);
  }

  warn(message, data = null) {
    const entry = this.formatLogEntry('WARN', message, data);
    const filename = `pipeline-${this.getDateString()}.log`;
    this.writeToFile(filename, entry);
  }

  // Log específico de vendedor
  logVendor(vendorId, message, data = null) {
    const entry = this.formatLogEntry('INFO', message, data);
    const filename = `${vendorId}-${this.getDateString()}.log`;
    this.writeToFile(filename, entry);

    // También escribir en el log general
    this.log(`[${vendorId}] ${message}`, data);
  }

  errorVendor(vendorId, message, error = null) {
    const data = error ? { error: error.message, stack: error.stack } : null;
    const entry = this.formatLogEntry('ERROR', message, data);
    const filename = `${vendorId}-${this.getDateString()}.log`;
    this.writeToFile(filename, entry);

    // También escribir en el log general
    this.error(`[${vendorId}] ${message}`, data);
  }

  // Log de fase
  logPhase(vendorId, phase, message, data = null) {
    this.logVendor(vendorId, `[${phase}] ${message}`, data);
  }

  // Log de inicio de vendedor
  logVendorStart(vendorId, phases) {
    this.logVendor(vendorId, 'Iniciando procesamiento', { phases });
  }

  // Log de finalización de vendedor
  logVendorComplete(vendorId, status, error = null) {
    if (status === 'completado') {
      this.logVendor(vendorId, 'Procesamiento completado exitosamente');
    } else {
      this.errorVendor(vendorId, 'Procesamiento finalizado con errores', error);
    }
  }

  // Log de fase completada
  logPhaseComplete(vendorId, phase) {
    this.logPhase(vendorId, phase, 'Fase completada');
  }

  // Log de reintento
  logRetry(vendorId, phase, attempt, maxAttempts) {
    this.logPhase(vendorId, phase, `Reintento ${attempt}/${maxAttempts}`);
  }

  // Log de sincronización
  logSync(vendorsAdded) {
    this.log('Sincronización con projects.json completada', { vendorsAdded });
  }

  // Log de comando
  logCommand(command, params = null) {
    this.log(`Comando ejecutado: ${command}`, params);
  }
}

module.exports = new Logger();
