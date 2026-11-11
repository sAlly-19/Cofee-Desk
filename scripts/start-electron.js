const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('[Runner] Iniciando Electron com GUI habilitada...');
const child = spawn(electron, ['.'], { stdio: 'inherit', env });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
