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
    charDelay = 5,  // Reducido de 15 a 5ms (3x más rápido)
    lineDelay = 30, // Reducido de 100 a 30ms
    skipTypewriter = false
  } = options;

  if (skipTypewriter || process.env.SKIP_TYPEWRITER === 'true') {
    console.log(text);
    return;
  }

  // Si charDelay es 0, usar console.log directo (más rápido y sin interferir con readline)
  if (charDelay === 0) {
    console.log(text);
    await new Promise(resolve => setTimeout(resolve, lineDelay));
    return;
  }

  for (const char of text) {
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, charDelay));
  }
  
  process.stdout.write('\n');
  await new Promise(resolve => setTimeout(resolve, lineDelay));
}

/**
 * Mostrar línea separadora
 */
async function showSeparator(char = '─', length = 50) {
  await typewriteLine(char.repeat(length), { charDelay: 0 });
}

/**
 * Mostrar título con formato
 */
async function showTitle(text, options = {}) {
  const { separator = true, icon = '🎯' } = options;
  
  if (separator) {
    await showSeparator('═');
  }
  
  await typewriteLine(`${icon} ${text}`, { charDelay: 3 }); // Reducido de 12 a 3ms
  
  if (separator) {
    await showSeparator('═');
  }
  
  await typewriteLine('');
}

/**
 * Mostrar mensaje de error
 */
async function showError(message) {
  await typewriteLine(`❌ ${message}`, { charDelay: 3 }); // Reducido de 10 a 3ms
  await typewriteLine('');
}

/**
 * Mostrar mensaje de éxito
 */
async function showSuccess(message) {
  await typewriteLine(`✅ ${message}`, { charDelay: 3 }); // Reducido de 10 a 3ms
  await typewriteLine('');
}

/**
 * Mostrar mensaje de advertencia
 */
async function showWarning(message) {
  await typewriteLine(`⚠️  ${message}`, { charDelay: 3 }); // Reducido de 10 a 3ms
  await typewriteLine('');
}

/**
 * Mostrar mensaje de información
 */
async function showInfo(message) {
  await typewriteLine(`ℹ️  ${message}`, { charDelay: 3 }); // Reducido de 10 a 3ms
  await typewriteLine('');
}

/**
 * Limpiar pantalla
 */
function clearScreen() {
  console.clear();
}

/**
 * Pausa con mensaje
 */
async function pause(message = 'Presiona Enter para continuar...') {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
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
