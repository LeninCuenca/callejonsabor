const fs = require('fs');
const path = require('path');
const readline = require('readline');

const examplePath = path.resolve(__dirname, '..', '.env.example');
const targetPath = path.resolve(__dirname, '..', '.env');

if (!fs.existsSync(examplePath)) {
  console.error('.env.example not found in project root');
  process.exit(1);
}

const content = fs.readFileSync(examplePath, 'utf8');
const lines = content.split(/\r?\n/);

function askQuestion(rl, question, defaultValue) {
  return new Promise(resolve => {
    const q = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(q, answer => {
      if (!answer && typeof defaultValue !== 'undefined') return resolve(defaultValue);
      resolve(answer);
    });
  });
}

async function run() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const entries = [];

  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue; // skip comments and blanks
    const key = m[1];
    const defaultValue = m[2] ? m[2] : '';
    const answer = await askQuestion(rl, `Valor para ${key}`, defaultValue);
    entries.push({ key, value: answer });
  }

  rl.close();

  const out = entries.map(e => `${e.key}=${e.value}`).join('\n') + '\n';
  fs.writeFileSync(targetPath, out, { encoding: 'utf8', flag: 'w' });
  console.log(`Escrito ${targetPath}`);
  console.log('Recuerda no subir .env a repositorios públicos.');
}

run().catch(err => {
  console.error('Error creando .env:', err);
  process.exit(1);
});
