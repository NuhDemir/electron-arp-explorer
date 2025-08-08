import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Electron'un build sonrası dosya yollarını doğru bulması için base ayarı.
  base: './',
  plugins: [react()],
  // React uygulamasının hangi klasörden çalışacağını ve build edileceğini belirtir.
  root: 'src/renderer',
  build: {
    // Build çıktısının projenin kök dizinindeki 'dist/renderer' klasörüne yapılmasını sağlar.
    outDir: '../../dist/renderer',
  }
});