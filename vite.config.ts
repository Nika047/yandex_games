import { defineConfig } from 'vite';

// base './' - чтобы собранная игра открывалась из любой папки (архив для Яндекс Игр)
export default defineConfig({
    base: './',
    build: {
        chunkSizeWarningLimit: 2000
    }
});
