import { spawn } from 'child_process'
import { install, getBinaryPath } from './installer.js'
import { healthCheck } from './health.js'
import { logger } from './logger.js'
import { saveTunnel, getTunnel } from './config.js'

const activeTunnels = new Map()

export async function startTunnel(options = {}) {
  const {
    port = 3000,
    token = null,
    name = null,
    skipHealthCheck = false,
    autoRestart = false
  } = options

  let binaryPath = getBinaryPath()
  if (!binaryPath) {
    logger.info('cloudflared tidak ditemukan, menginstall otomatis...')
    binaryPath = await install()
  }

  if (!skipHealthCheck) {
    const alive = await healthCheck(port)
    if (!alive) {
      logger.warn(`Port ${port} tidak aktif. Lanjutkan dengan risiko sendiri.`)
    }
  }

  return new Promise((resolve, reject) => {
    let args = []

    if (token) {
      args = ['tunnel', '--no-autoupdate', 'run', '--token', token]
    } else {
      args = ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`]
    }

    logger.info(`Memulai tunnel${name ? ` [${name}]` : ''} → port ${port}`)

    const proc = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let tunnelUrl = null
    let resolved = false

    const tunnelId = name || `tunnel_${Date.now()}`
    activeTunnels.set(tunnelId, { proc, port, name, startedAt: new Date().toISOString() })

    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error('Timeout: tunnel tidak terhubung dalam 30 detik'))
        proc.kill()
      }
    }, 30000)

    const handleOutput = (data) => {
      const text = data.toString()
      logger.debug(text.trim())

      const match = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/)
      if (match && !resolved) {
        tunnelUrl = match[0]
        resolved = true
        clearTimeout(timeout)

        if (name) {
          saveTunnel(name, { port, token, url: tunnelUrl, status: 'active' })
        }

        logger.info(`✓ Tunnel aktif: ${tunnelUrl}`)
        resolve({ url: tunnelUrl, id: tunnelId, process: proc, stop: () => stopTunnel(tunnelId) })
      }

      if (token && text.includes('Registered tunnel connection') && !resolved) {
        resolved = true
        clearTimeout(timeout)
        if (name) saveTunnel(name, { port, token, status: 'active' })
        logger.info(`✓ Named tunnel aktif`)
        resolve({ url: null, id: tunnelId, process: proc, stop: () => stopTunnel(tunnelId) })
      }
    }

    proc.stdout.on('data', handleOutput)
    proc.stderr.on('data', handleOutput)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Gagal menjalankan cloudflared: ${err.message}`))
    })

    proc.on('exit', (code) => {
      activeTunnels.delete(tunnelId)
      if (name) saveTunnel(name, { port, token, status: 'stopped' })
      if (!resolved) {
        clearTimeout(timeout)
        reject(new Error(`cloudflared keluar dengan kode: ${code}`))
      } else {
        logger.info(`Tunnel ${tunnelId} dihentikan (exit ${code})`)
        if (autoRestart && resolved) {
          logger.warn('Auto-restart aktif, memulai ulang tunnel...')
          setTimeout(() => startTunnel(options), 3000)
        }
      }
    })
  })
}

export function stopTunnel(id) {
  if (id) {
    const t = activeTunnels.get(id)
    if (t) { t.proc.kill('SIGTERM'); activeTunnels.delete(id); return true }
  }
  for (const [, t] of activeTunnels) t.proc.kill('SIGTERM')
  activeTunnels.clear()
  return true
}

export function getActiveTunnels() {
  const result = []
  for (const [id, t] of activeTunnels) {
    result.push({ id, port: t.port, name: t.name, startedAt: t.startedAt })
  }
  return result
}
