import { defineConfig } from 'vite';
import sass from 'vite-plugin-sass-dts';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url))
console.log('Current directory:', currentDir);

export default defineConfig({
    plugins: [
        sass()
    ],
  root: 'examples',
});
