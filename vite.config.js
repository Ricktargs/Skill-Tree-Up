import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
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

// =========================================================
// SKINS: public/skins
// O app recebe a lista das imagens que existem na pasta (menos
// "_originais"), para só carregar o que foi colocado lá.
// Trocou um arquivo com o "npm run dev" aberto: o app recarrega.
// =========================================================
const ROOT = dirname(fileURLToPath(import.meta.url))
const SKINS_DIR = join(ROOT, 'public', 'skins')
const SKIN_EXT = /\.(png|svg|webp|gif|jpe?g)$/i

function listSkins(dir = SKINS_DIR) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listSkins(full))
    else if (SKIN_EXT.test(name)) out.push(relative(SKINS_DIR, full).split(sep).join('/'))
  }
  return out
}

const skinsPlugin = () => {
  const ID = 'virtual:orbe-skins'
  const RID = '\0' + ID
  return {
    name: 'orbe-skins',
    resolveId(id) {
      return id === ID ? RID : null
    },
    load(id) {
      if (id !== RID) return null
      const files = listSkins()
      const stamp = Date.now()
      return `export default ${JSON.stringify(files)};\nexport const STAMP = ${stamp};`
    },
    // os originais ficam só no projeto (não vão para o programa instalado)
    closeBundle() {
      const extra = join(ROOT, 'dist', 'skins', '_originais')
      if (existsSync(extra)) rmSync(extra, { recursive: true, force: true })
    },
    configureServer(server) {
      const reload = (file) => {
        if (!file.startsWith(SKINS_DIR) || file.includes('_originais') || !SKIN_EXT.test(file)) return
        const mod = server.moduleGraph.getModuleById(RID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.add(SKINS_DIR)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
      server.watcher.on('change', reload)
      // só no "npm run dev": grava os originais exportados pelo próprio app
      server.middlewares.use('/__orbe-skins/write', (req, res) => {
        if (req.method !== 'POST') return res.end()
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { path, data, text } = JSON.parse(body)
            const target = join(SKINS_DIR, path)
            if (!target.startsWith(SKINS_DIR) || path.includes('..')) throw new Error('caminho inválido')
            mkdirSync(dirname(target), { recursive: true })
            if (text !== undefined) writeFileSync(target, text, 'utf8')
            else writeFileSync(target, Buffer.from(String(data).split(',').pop(), 'base64'))
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String(e.message || e))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), viteSingleFile(), versionFile(), skinsPlugin()],
})
