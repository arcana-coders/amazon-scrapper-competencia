/**
 * MÓDULO: GESTIÓN DE PLANTILLAS
 */

const { typewriteLine, showTitle, showInfo, ask } = require('./utils/display-utils');

async function show(rl) {
  await typewriteLine('');
  await showTitle('GESTIÓN DE PLANTILLAS (FASE 4A)', { icon: '📄' });
  await showInfo('Módulo en desarrollo');
  await typewriteLine('');
}

module.exports = { show };
