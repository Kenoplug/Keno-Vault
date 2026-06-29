var fs = require('fs');
var files = ['pages/dashboard.html', 'pages/settings.html', 'index.html'];

// Emoji -> Font Awesome icon. Include variations.
var map = [
  // Navigation / UI
  ['📊','fa-chart-pie'],['📦','fa-box'],['📈','fa-arrow-trend-up'],['🔥','fa-fire'],
  ['⚖️','fa-scale-balanced'],['⚖','fa-scale-balanced'],['🧾','fa-receipt'],
  ['🎯','fa-bullseye'],['⚡','fa-bolt'],['🌍','fa-globe'],['⚙','fa-gear'],
  ['💵','fa-money-bill'],['⚠️','fa-triangle-exclamation'],['⚠','fa-triangle-exclamation'],
  ['🛡','fa-shield-halved'],['🛡️','fa-shield-halved'],['🔒','fa-lock'],
  ['🏆','fa-trophy'],['✅','fa-circle-check'],['✓','fa-circle-check'],
  ['💧','fa-droplet'],['🕐','fa-clock'],['💡','fa-lightbulb'],
  ['🏛','fa-building-columns'],['🏛️','fa-building-columns'],
  ['💳','fa-credit-card'],['💾','fa-database'],['🔐','fa-shield'],
  ['⬇','fa-download'],['🗑','fa-trash'],['📋','fa-clipboard-list'],
  ['🪙','fa-coins'],['◈','fa-gem'],['◇','fa-gem'],
  ['↑','fa-arrow-up'],['📉','fa-arrow-trend-down'],
  ['📧','fa-envelope'],['🔔','fa-bell'],['🎨','fa-palette'],
  ['📄','fa-file-lines'],['📥','fa-download'],['🔓','fa-unlock'],
  ['👤','fa-user'],['☁️','fa-cloud'],['☁','fa-cloud'],
  // Debt optimizer
  ['❄️','fa-snowflake'],['❄','fa-snowflake'],['⛄','fa-snowman'],['⛄️','fa-snowman'],
  // Actions
  ['✕','fa-xmark'],['✎','fa-pencil'],['←','fa-arrow-left'],['→','fa-arrow-right'],
  // Greetings
  ['👋','fa-hand'],['🍩','fa-chart-pie'],
  // Misc
  ['☢','fa-circle-radiation'],['☢️','fa-circle-radiation'],
  ['⋯','fa-ellipsis'],['…','fa-ellipsis'],
  // Specific ones that appear inside tags without space
  ['🔴','fa-circle'],['🟡','fa-circle'],['🟢','fa-circle'],
];

files.forEach(function(f) {
  var c = fs.readFileSync(f, 'utf8');
  var count = 0;
  map.forEach(function(pair) {
    var emoji = pair[0], icon = pair[1];
    // Match emoji followed by space, or emoji at end of string, or emoji before <
    var before = c.length;
    c = c.split(emoji + ' ').join('<i class="fas ' + icon + '"></i> ');
    c = c.split(emoji + '</').join('<i class="fas ' + icon + '"></i></');
    c = c.split(emoji + '"').join('<i class="fas ' + icon + '"></i>"');
    c = c.split(emoji + '\n').join('<i class="fas ' + icon + '"></i>\n');
    if (c.length !== before) count++;
  });
  fs.writeFileSync(f, c);
  console.log(f + ': replaced ' + count + ' emoji types');
});
