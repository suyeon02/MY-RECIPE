import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';



export default defineConfig(() => {
  return {
    // GitHub Pages serves project sites from a repository subpath.
    // Relative asset URLs keep the built app working from that location.
   base: '/', // GitHub Pages용 경로('/MY-RECIPE/') 대신 '/'로 설정
    plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png'],
    manifest: {
      name: 'MY RECIPE',
      short_name: 'MY RECIPE',
      description: 'SNS & 유튜브 요약 레시피 정리기',
      theme_color: '#ff7a00',
      background_color: '#fcfbf9',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  }),
],
  };




  
});
