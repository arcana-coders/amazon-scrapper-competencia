const TelegramNotifier = require('./automation/telegram-notifier');

const SELLER_ID = 'A1HGYOYPGEKVQ5';

async function sendNotification() {
  const telegram = new TelegramNotifier();

  const message =
    `✅ *Procesamiento Completo del Vendedor*\n\n` +
    `🆔 Vendedor: \`${SELLER_ID}\`\n\n` +
    `📊 *Resultados:*\n` +
    `   • Total productos: 306\n` +
    `   • Verificados MX: 306 (100%)\n` +
    `   • Verificados USA: 232 (76%)\n` +
    `   • Productos filtrados: 232\n\n` +
    `💰 *Oportunidades encontradas:*\n` +
    `   • Directas: 0\n` +
    `   • Con descuento -$50: 0\n` +
    `   • Con descuento -$100: 0\n\n` +
    `⚠️ *Conclusión:*\n` +
    `Este vendedor no tiene productos rentables.\n` +
    `Los precios son muy bajos para generar margen.\n\n` +
    `📁 Archivos generados en:\n` +
    `\`data/vendors/${SELLER_ID}/\`\n\n` +
    `🎯 Tiempo total: ~2 horas\n` +
    `🤖 Proceso 100% automático`;

  await telegram.sendMessage(message);

  console.log('✅ Notificación enviada exitosamente');
}

sendNotification().catch(error => {
  console.error('❌ Error enviando notificación:', error.message);
  process.exit(1);
});
