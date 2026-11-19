import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Versão do programa (package.json) e um carimbo de cada build.
// O site compara o carimbo com o version.json do servidor para saber se tem atualização.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const BUILD_ID = String(Date.now())

const versionFile = () => ({
  name: 'orbe-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: pkg.version, buildId: BUILD_ID }),
    })
  },
})

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), viteSingleFile(), versionFile()],
})
