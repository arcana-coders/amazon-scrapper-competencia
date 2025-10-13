/**
 * MÓDULO: PUBLICAR PRODUCTOS
 */

const { typewriteLine, showTitle, showInfo, ask } = require('./utils/display-utils');

async function show(rl) {
  await typewriteLine('');
  await showTitle('PUBLICAR PRODUCTOS (FASE 4B)', { icon: '🚀' });
  await showInfo('Módulo en desarrollo');
  await typewriteLine('');
}

module.exports = { show };
