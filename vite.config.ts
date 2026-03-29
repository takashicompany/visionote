import { defineConfig } from 'vite'
import { readFileSync } from 'fs'

const appJson = JSON.parse(readFileSync('./app.json', 'utf-8'))

export default defineConfig(({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(appJson.version),
  },
  base: command === 'build' ? './' : '/',
  server: {
    host: true,
    port: 5174,
  },
  plugins: [
    {
      name: 'log-receiver',
      configureServer(server) {
        server.middlewares.use('/api/log', (req, res) => {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => (body += chunk.toString()))
            req.on('end', () => {
              console.log(`[DEVICE] ${body}`)
              res.writeHead(200, { 'Content-Type': 'text/plain' })
              res.end('ok')
            })
          } else {
            res.writeHead(405)
            res.end()
          }
        })
      },
    },
  ],
}))
