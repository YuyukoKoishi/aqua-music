import { createServerApp } from './app.ts'

const DEFAULT_PORT = 9528

export function startServer(port = DEFAULT_PORT): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const { app } = createServerApp()
    const server = app.listen(0, '127.0.0.1', () => {
      // port 0 first for tests; production path below probes upward
    })
    server.on('error', reject)
    resolve({
      url: 'http://127.0.0.1:' + (server.address() as { port: number }).port,
      close: () => new Promise(res => server.close(() => res())),
    })
  })
}

function isDirectRun(): boolean {
  return process.argv[1] && import.meta.url === 'file:///' + process.argv[1].replace(/\\/g, '/')
}

// production entry: probe from DEFAULT_PORT upward
if (isDirectRun()) {
  import('./app.ts').then(({ probePort }) => probePort(DEFAULT_PORT)).then(port => {
    const { app } = createServerApp()
    app.listen(port, '127.0.0.1', () => {
      console.log('aqua-music listening at http://127.0.0.1:' + port)
    })
  })
}

export { DEFAULT_PORT }
