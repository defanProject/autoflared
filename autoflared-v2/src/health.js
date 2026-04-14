import net from 'net'
import { getConfig } from './config.js'
import { logger } from './logger.js'

export function checkPort(port, timeout) {
  const config = getConfig()
  const ms = timeout || config.healthCheckTimeout || 5000

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false

    const done = (result) => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve(result)
      }
    }

    socket.setTimeout(ms)
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
    socket.connect(port, '127.0.0.1')
  })
}

export async function waitForPort(port, retries = 10, interval = 1000) {
  for (let i = 0; i < retries; i++) {
    const ok = await checkPort(port)
    if (ok) return true
    if (i < retries - 1) {
      logger.debug(`Port ${port} belum aktif, mencoba lagi (${i + 1}/${retries})...`)
      await new Promise(r => setTimeout(r, interval))
    }
  }
  return false
}

export async function healthCheck(port) {
  logger.info(`Memeriksa port ${port}...`)
  const ok = await checkPort(port)
  if (ok) {
    logger.info(`✓ Port ${port} aktif dan siap`)
  } else {
    logger.warn(`✗ Port ${port} tidak merespons`)
  }
  return ok
}
