if (typeof document !== 'undefined' && !document.getElementById('press-start-font')) {
  const link = document.createElement('link');
  link.id = 'press-start-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(link);
}
