import { defineConfig } from 'vite'
import { resolve } from 'path'
export default defineConfig({
  base: '/invoice/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        orangyads: resolve(__dirname, 'orangyads.html'),
        sachin: resolve(__dirname, 'sachin.html'),
      }
    }
  }
})
