var fs = require('fs');
var files = ['pages/dashboard.html', 'pages/settings.html', 'index.html'];

// Lucide name -> Font Awesome class
var map = {
  'layout-dashboard': 'fa-chart-pie',
  'package': 'fa-box',
  'trending-up': 'fa-arrow-trend-up',
  'flame': 'fa-fire',
  'scale': 'fa-scale-balanced',
  'receipt': 'fa-receipt',
  'target': 'fa-bullseye',
  'zap': 'fa-bolt',
  'globe': 'fa-globe',
  'settings': 'fa-gear',
  'banknote': 'fa-money-bill',
  'alert-triangle': 'fa-triangle-exclamation',
  'shield': 'fa-shield-halved',
  'lock': 'fa-lock',
  'trophy': 'fa-trophy',
  'circle-check': 'fa-circle-check',
  'droplets': 'fa-droplet',
  'clock': 'fa-clock',
  'lightbulb': 'fa-lightbulb',
  'building': 'fa-building-columns',
  'credit-card': 'fa-credit-card',
  'database': 'fa-database',
  'shield-check': 'fa-shield',
  'download': 'fa-download',
  'trash-2': 'fa-trash',
  'clipboard-list': 'fa-clipboard-list',
  'coins': 'fa-coins',
  'diamond': 'fa-gem',
  'arrow-up': 'fa-arrow-up',
  'circle': 'fa-circle',
  'trending-down': 'fa-arrow-trend-down',
  'mail': 'fa-envelope',
  'bell': 'fa-bell',
  'palette': 'fa-palette',
  'file-text': 'fa-file-lines',
  'unlock': 'fa-unlock',
  'user': 'fa-user',
  'cloud': 'fa-cloud',
  'rocket': 'fa-rocket',
};

files.forEach(function(f) {
  var c = fs.readFileSync(f, 'utf8');
  Object.keys(map).forEach(function(name) {
    var fa = map[name];
    var regex = new RegExp('<i data-lucide="' + name + '"></i>', 'g');
    c = c.replace(regex, '<i class="fas ' + fa + '"></i>');
  });
  // Remove lucide init script
  c = c.replace(/<script>lucide\.createIcons\(\);<\/script>/g, '');
  // Remove lucide CDN
  c = c.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/lucide@[\d.]+\/dist\/umd\/lucide\.min\.js"><\/script>/g, '');
  fs.writeFileSync(f, c);
  console.log(f + ': done');
});
