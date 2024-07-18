import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  base: './',  // This ensures all assets are referenced relatively
  plugins: [
    glsl(),
  ]
})
