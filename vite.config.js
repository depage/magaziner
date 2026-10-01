import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import sass from 'vite-plugin-sass-dts';

export default defineConfig({
    plugins: [
        dts({
            outDir: 'dist',
            rollupTypes: true,
            tsconfigPath: 'tsconfig.json',
            include: ['src'],
        }),
        sass()
    ],
    build: {
        // Skip dts type check errors (false positives from JS->TS migration)
        minify: false,
        lib: {
            entry: 'src/magaziner.ts',
            name: 'MagazineNavigator',
            formats: ['es'],
            fileName: 'magaziner',
        },
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        copyPublicDir: false,
    },
});
