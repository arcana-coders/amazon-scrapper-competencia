/**
 * MÓDULO: REPORTES Y ESTADO
 */

const { typewriteLine, showTitle, showInfo, ask } = require('./utils/display-utils');

async function show(rl) {
  await typewriteLine('');
  await showTitle('REPORTES Y ESTADO', { icon: '📊' });
  await showInfo('Módulo en desarrollo');
  await typewriteLine('');
}

module.exports = { show };
