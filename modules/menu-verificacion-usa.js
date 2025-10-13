/**
 * MÓDULO: VERIFICACIÓN EN AMAZON USA
 */

const { typewriteLine, showTitle, showInfo, ask } = require('./utils/display-utils');

async function show(rl) {
  await typewriteLine('');
  await showTitle('VERIFICAR EN AMAZON USA (FASE 2)', { icon: '✅' });
  await showInfo('Módulo en desarrollo');
  await typewriteLine('');
}

module.exports = { show };
