import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDirectory = new URL('../dist/', import.meta.url);
const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const serverDirectory = new URL('../dist/server/', import.meta.url);

await mkdir(assetsDirectory, { recursive: true });

for (const entry of await readdir(distDirectory, { withFileTypes: true })) {
  if (entry.name === 'assets' || entry.name === 'server') continue;
  await rename(
    join(distDirectory.pathname, entry.name),
    join(assetsDirectory.pathname, entry.name),
  );
}

const unusedLegacyAssets = [
  'images/ayana-yamazaki.jpg',
  'images/medical-ui/hero-interaction.gif',
  'images/reposaku-hero.png',
  'images/reposaku-live-map.gif',
];

await Promise.all(
  unusedLegacyAssets.map((asset) =>
    rm(join(assetsDirectory.pathname, asset), { force: true }),
  ),
);

await mkdir(serverDirectory, { recursive: true });
await writeFile(
  new URL('../dist/server/index.js', import.meta.url),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);
