/**
 * MÓDULO: GENERAR OPORTUNIDADES
 */

const { typewriteLine, showTitle, showInfo, ask } = require('./utils/display-utils');

async function show(rl) {
  await typewriteLine('');
  await showTitle('GENERAR OPORTUNIDADES (FASE 3)', { icon: '💰' });
  await showInfo('Módulo en desarrollo');
  await typewriteLine('');
}

module.exports = { show };
