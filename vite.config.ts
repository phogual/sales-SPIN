import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 모든 환경 변수(.env 및 Vercel 변수)를 로드합니다.
    const env = loadEnv(mode, process.cwd(), '');
    
    // VITE_ 로 시작하는 키를 우선적으로 찾습니다.
    const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 앱 내에서 어떤 변수명으로 호출해도 값이 전달되도록 정의합니다.
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
