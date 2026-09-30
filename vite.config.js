import { defineConfig } from 'vite';
import dts from 'vite-plugin-sass-dts';

export default defineConfig({
  plugins: [dts({
    outDir: 'dist',
    rollupTypes: true,
    tsconfigPath: 'jsconfig.json',
    include: ['src'],
  })],
  build: {
    lib: {
      entry: 'src/magaziner.js',
      name: 'MagazineNavigator',
      formats: ['es'],
      fileName: 'magaziner',
    },
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
