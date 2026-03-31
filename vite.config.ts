import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 모든 환경 변수를 로드
    const env = loadEnv(mode, process.cwd(), '');
    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";

    return {
      server: { port: 3000, host: '0.0.0.0' },
      plugins: [react()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: { '@': path.resolve(__dirname, '.') }
      }
    };
});
