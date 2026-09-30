import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/magaziner.js',
      name: 'MagazineNavigator',
      formats: ['es'],
      fileName: 'magaziner',
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
