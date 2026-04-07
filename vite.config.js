import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../_build',
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
  },
  plugins: [viteSingleFile()],
});
