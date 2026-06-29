var fs = require('fs');
var files = ['pages/settings.html', 'index.html'];
var map = {
  '📊': 'layout-dashboard', '📦': 'package', '📈': 'trending-up', '🔥': 'flame',
  '⚖️': 'scale', '🧾': 'receipt', '🎯': 'target', '⚡': 'zap', '🌍': 'globe',
  '⚙': 'settings', '💵': 'banknote', '⚠️': 'alert-triangle', '🛡': 'shield',
  '🔒': 'lock', '🏆': 'trophy', '✅': 'circle-check', '💧': 'droplets',
  '🕐': 'clock', '💡': 'lightbulb', '🏛': 'building', '💳': 'credit-card',
  '💾': 'database', '🔐': 'shield-check', '⬇': 'download', '🗑': 'trash-2',
  '📋': 'clipboard-list', '🪙': 'coins', '◈': 'diamond', '◇': 'diamond',
  '↑': 'arrow-up', '🔴': 'circle', '🟡': 'circle', '🟢': 'circle',
  '📉': 'trending-down', '📧': 'mail', '🔔': 'bell', '🎨': 'palette',
  '📄': 'file-text', '📥': 'download', '🔓': 'unlock',
  '👤': 'user', '☁️': 'cloud', '🌙': 'sun-moon',
};
files.forEach(function(f) {
  var c = fs.readFileSync(f, 'utf8');
  Object.keys(map).forEach(function(emoji) {
    var icon = map[emoji];
    var escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp(escaped + ' ', 'g');
    c = c.replace(regex, '<i data-lucide="' + icon + '"></i> ');
  });
  fs.writeFileSync(f, c);
  console.log(f + ': done');
});
