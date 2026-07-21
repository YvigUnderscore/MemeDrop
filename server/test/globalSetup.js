import fs from 'node:fs';
import path from 'node:path';

// Repart d'une base propre à chaque exécution de la suite.
export default function () {
  const dir = path.resolve('./.vitest-data');
  fs.rmSync(dir, { recursive: true, force: true });
  return () => { fs.rmSync(dir, { recursive: true, force: true }); };
}
