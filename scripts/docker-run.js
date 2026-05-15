const { execSync } = require('child_process');

try {
  execSync('docker rm -f baby-statistic', { stdio: 'pipe' });
} catch (_) {
  // container didn't exist — that's fine
}

execSync(
  'docker run -d --name baby-statistic -p 80:80 -v baby-statistic-data:/app/data --restart=on-failure baby-statistic',
  { stdio: 'inherit' }
);

console.log('\n✅ Container started — http://localhost\n');

