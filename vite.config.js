import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../',
    emptyOutDir: false,
    minify: false,
    cssMinify: false,
  },
  plugins: [viteSingleFile()],
});
