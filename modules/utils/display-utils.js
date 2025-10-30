/**
 * UTILIDADES DE DISPLAY
 * 
 * Funciones para mostrar texto con efectos y formato
 */

/**
 * Efecto typewriter para escribir texto
 */
async function typewriteLine(text, options = {}) {
  const {
    charDelay = 0,  // Cambiado a 0ms para ser instantáneo
    lineDelay = 5,  // Reducido a 5ms para ser muy rápido
    skipTypewriter = false
  } = options;

  if (skipTypewriter || process.env.SKIP_TYPEWRITER === 'true') {
    console.log(text);
    return;
  }

    // Ignoramos cualquier opción de delay para mantener salida inmediata
    console.log(text);
}

/**
 * Mostrar línea separadora
 */
async function showSeparator(char = '─', length = 50) {
  await typewriteLine(char.repeat(length));
}

/**
 * Mostrar título con formato
 */
async function showTitle(text, options = {}) {
  const { separator = true, icon = '🎯' } = options;
  
  if (separator) {
    await showSeparator('═');
  }
  
    await typewriteLine(`${icon} ${text}`);
  
  if (separator) {
    await showSeparator('═');
  }
  
  await typewriteLine('');
}

/**
 * Mostrar mensaje de error
 */
async function showError(message) {
  await typewriteLine(`❌ ${message}`);
  await typewriteLine('');
}

/**
 * Mostrar mensaje de éxito
 */
async function showSuccess(message) {
  await typewriteLine(`✅ ${message}`);
  await typewriteLine('');
}

/**
 * Mostrar mensaje de advertencia
 */
async function showWarning(message) {
  await typewriteLine(`⚠️  ${message}`);
  await typewriteLine('');
}

/**
 * Mostrar mensaje de información
 */
async function showInfo(message) {
  await typewriteLine(`ℹ️  ${message}`);
  await typewriteLine('');
}

/**
 * Limpiar pantalla
 */
function clearScreen() {
  // No limpiar pantalla para mantener historial visible según requerimiento
}

/**
 * Pausa con mensaje
 * Acepta ya sea un rl existente o un mensaje de texto.
 * - Si se pasa un objeto con método question (rl), usa ese rl y NO crea uno nuevo.
 * - Si se pasa un string (mensaje) o nada, crea un rl temporal y lo cierra al finalizar.
 */
async function pause(rlOrMessage = 'Presiona Enter para continuar...') {
  const isRl = rlOrMessage && typeof rlOrMessage === 'object' && typeof rlOrMessage.question === 'function';
  const message = isRl ? 'Presiona Enter para continuar...' : rlOrMessage;

  if (isRl) {
    const rl = rlOrMessage;
    return new Promise(resolve => {
      rl.question(message, () => {
        resolve();
      });
    });
  } else {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.question(message, () => {
        rl.close();
        resolve();
      });
    });
  }
}

/**
 * Leer entrada del usuario
 * Nota: Para evitar duplicación de input, no usar typewriter antes de ask()
 */
async function ask(rl, question) {
  // Desactivar temporalmente el typewriter effect
  return new Promise(resolve => {
    // Usar setImmediate para asegurar que todo el output anterior se haya procesado
    setImmediate(() => {
      rl.question(question, answer => {
        resolve(answer.trim());
      });
    });
  });
}

module.exports = {
  typewriteLine,
  showSeparator,
  showTitle,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  clearScreen,
  pause,
  ask
};
