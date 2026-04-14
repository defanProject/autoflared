import { readFileSync, existsSync } from 'fs'
import { LOG_PATH } from './config.js'
import { getActiveTunnels } from './tunnel.js'
import { getStatus } from './status.js'
import { getServiceStatus } from './service.js'
import { COLORS } from './logger.js'

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}

function box(title, lines, width = 50) {
  const top = `╔${'═'.repeat(width - 2)}╗`
  const bottom = `╚${'═'.repeat(width - 2)}╝`
  const titleLine = `║ ${COLORS.bold}${title}${COLORS.reset}${' '.repeat(width - title.length - 3)}║`
  const divider = `╠${'═'.repeat(width - 2)}╣`
  const body = lines.map(l => {
    const clean = l.replace(/\x1b\[[0-9;]*m/g, '')
    const pad = Math.max(0, width - clean.length - 3)
    return `║ ${l}${' '.repeat(pad)}║`
  })
  return [top, titleLine, divider, ...body, bottom].join('\n')
}

function getLastLogs(n = 8) {
  if (!existsSync(LOG_PATH)) return ['(belum ada log)']
  try {
    const lines = readFileSync(LOG_PATH, 'utf8').trim().split('\n')
    return lines.slice(-n).map(l => {
      const clean = l.replace(/\[.*?\] \[.*?\] /, '')
      if (clean.length > 46) return clean.substring(0, 43) + '...'
      return clean
    })
  } catch { return ['(gagal baca log)'] }
}

export function renderDashboard() {
  const status = getStatus()
  const active = getActiveTunnels()
  const serviceStatus = (() => { try { return getServiceStatus() } catch { return 'n/a' } })()

  clearScreen()

  console.log(`
${COLORS.bold}  ╔═══════════════════════════════════════════════╗
  ║         autoflared v2.0 — Dashboard           ║
  ╚═══════════════════════════════════════════════╝${COLORS.reset}
`)

  const statusColor = status.installed ? COLORS.info : COLORS.error
  const statusText = status.installed ? `✓ Terinstall (v${status.version})` : '✗ Belum terinstall'

  console.log(box('System Status', [
    `Binary   : ${statusColor}${statusText}${COLORS.reset}`,
    `Service  : ${serviceStatus === 'running' ? COLORS.info : COLORS.warn}${serviceStatus}${COLORS.reset}`,
    `Path     : ${status.binaryPath || 'tidak ditemukan'}`,
    `Waktu    : ${new Date().toLocaleString('id-ID')}`
  ]))

  console.log()

  if (active.length === 0) {
    console.log(box('Tunnel Aktif', [`${COLORS.warn}Tidak ada tunnel yang berjalan${COLORS.reset}`]))
  } else {
    const lines = active.map((t, i) =>
      `${i + 1}. [${t.name || t.id}] port ${t.port} — sejak ${new Date(t.startedAt).toLocaleTimeString('id-ID')}`
    )
    console.log(box('Tunnel Aktif', lines))
  }

  console.log()
  console.log(box('Log Terbaru', getLastLogs(8)))
  console.log(`\n  ${COLORS.dim}Refresh otomatis setiap 3 detik. Tekan Ctrl+C untuk keluar.${COLORS.reset}\n`)
}

export function startDashboard(interval = 3000) {
  renderDashboard()
  const timer = setInterval(renderDashboard, interval)
  process.on('SIGINT', () => {
    clearInterval(timer)
    console.log('\nDashboard ditutup.')
    process.exit(0)
  })
}
