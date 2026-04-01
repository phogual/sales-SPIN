import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 모든 환경 변수를 로드 (세 번째 인자를 ''로 두어야 모든 변수를 가져옴)
    const env = loadEnv(mode, process.cwd(), '');
    
    // Vercel에 등록된 어떤 이름이든 하나라도 걸리도록 우선순위 설정
    const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 앱 내의 process.env에서 어떤 이름을 호출해도 값이 들어가도록 강제 주입
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
