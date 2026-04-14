#!/usr/bin/env node
import { install, update } from '../src/installer.js'
import { startTunnel, stopTunnel, getActiveTunnels } from '../src/tunnel.js'
import { installService, uninstallService, getServiceStatus } from '../src/service.js'
import { getStatus } from '../src/status.js'
import { healthCheck } from '../src/health.js'
import { startDashboard } from '../src/dashboard.js'
import { logger, COLORS } from '../src/logger.js'
import { getConfig, setConfig, getTunnels, saveTunnel, deleteTunnel } from '../src/config.js'
import { readFileSync, existsSync } from 'fs'
import { LOG_PATH } from '../src/config.js'

const args = process.argv.slice(2)
const command = args[0]
const sub = args[1]

function parseFlags(args) {
  const result = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true
      result[key] = val
    }
  }
  return result
}

function printHelp() {
  console.log(`
${COLORS.bold}  ╔══════════════════════════════════════════════════╗
  ║          autoflared v1.0 by defan            ║
  ║     Auto Cloudflare Tunnel Manager              ║
  ╚══════════════════════════════════════════════════╝${COLORS.reset}

  ${COLORS.bold}Usage:${COLORS.reset}
    autoflared <command> [subcommand] [options]

  ${COLORS.bold}Commands:${COLORS.reset}
    ${COLORS.info}install${COLORS.reset}                    Download & install cloudflared binary
      --force                Paksa reinstall meskipun sudah ada

    ${COLORS.info}update${COLORS.reset}                     Update cloudflared ke versi terbaru

    ${COLORS.info}start${COLORS.reset}                      Mulai quick tunnel
      --port <number>        Port target (default: 3000)
      --token <token>        Cloudflare tunnel token
      --name <name>          Nama tunnel (untuk disimpan)
      --auto-restart         Restart otomatis jika mati
      --skip-health          Skip pengecekan port

    ${COLORS.info}tunnel${COLORS.reset} <subcommand>        Kelola named tunnels
      list                   Tampilkan semua tunnel tersimpan
      save <name>            Simpan config tunnel baru
        --port <number>      Port tunnel
        --token <token>      Token tunnel
      delete <name>          Hapus tunnel tersimpan
      run <name>             Jalankan tunnel tersimpan

    ${COLORS.info}service${COLORS.reset} <subcommand>       Kelola daemon/service
      install                Install sebagai system service
        --port <number>      Port (default: 3000)
        --token <token>      Token (opsional)
      uninstall              Hapus system service
      status                 Cek status service

    ${COLORS.info}health${COLORS.reset}                     Cek apakah port aktif
      --port <number>        Port yang dicek (default: 3000)

    ${COLORS.info}log${COLORS.reset}                        Tampilkan log
      --lines <number>       Jumlah baris (default: 50)
      --follow               Ikuti log secara realtime

    ${COLORS.info}dashboard${COLORS.reset}                  Tampilkan live dashboard

    ${COLORS.info}status${COLORS.reset}                     Cek status instalasi

    ${COLORS.info}config${COLORS.reset} <subcommand>        Kelola konfigurasi
      show                   Tampilkan config saat ini
      set <key> <value>      Ubah nilai config

  ${COLORS.bold}Examples:${COLORS.reset}
    autoflared install
    autoflared start --port 3000
    autoflared start --port 8080 --name myapp --auto-restart
    autoflared tunnel save myapp --port 3000 --token TOKEN
    autoflared tunnel run myapp
    autoflared service install --port 3000
    autoflared health --port 3000
    autoflared log --lines 100
    autoflared dashboard
    autoflared config set defaultPort 8080
`)
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  const flags = parseFlags(args)

  if (command === 'install') {
    try { await install({ force: flags.force === true }) }
    catch (err) { logger.error(err.message); process.exit(1) }
    return
  }

  if (command === 'update') {
    try { await update() }
    catch (err) { logger.error(err.message); process.exit(1) }
    return
  }

  if (command === 'start') {
    const port = parseInt(flags.port) || 3000
    const token = flags.token || null
    const name = flags.name || null
    const autoRestart = flags['auto-restart'] === true
    const skipHealthCheck = flags['skip-health'] === true

    try {
      const tunnel = await startTunnel({ port, token, name, autoRestart, skipHealthCheck })
      console.log(`\n  ${COLORS.bold}Tunnel Info:${COLORS.reset}`)
      console.log(`  Port    : ${port}`)
      if (tunnel.url) console.log(`  URL     : ${COLORS.info}${tunnel.url}${COLORS.reset}`)
      if (name) console.log(`  Nama    : ${name}`)
      console.log(`\n  Tekan Ctrl+C untuk stop\n`)

      process.on('SIGINT', () => {
        logger.info('Menghentikan tunnel...')
        tunnel.stop()
        process.exit(0)
      })
    } catch (err) {
      logger.error(err.message)
      process.exit(1)
    }
    return
  }

  if (command === 'tunnel') {
    if (!sub || sub === 'list') {
      const tunnels = getTunnels()
      const keys = Object.keys(tunnels)
      if (keys.length === 0) {
        console.log('Belum ada tunnel tersimpan.')
      } else {
        console.log(`\n${COLORS.bold}Tunnel Tersimpan:${COLORS.reset}`)
        keys.forEach(k => {
          const t = tunnels[k]
          console.log(`  ${COLORS.info}${k}${COLORS.reset} — port ${t.port} | status: ${t.status || 'unknown'} | ${t.updatedAt || ''}`)
        })
        console.log()
      }
      return
    }

    if (sub === 'save') {
      const name = args[2]
      if (!name) { logger.error('Nama tunnel wajib diisi'); process.exit(1) }
      const port = parseInt(flags.port) || 3000
      const token = flags.token || null
      saveTunnel(name, { port, token, status: 'saved' })
      logger.info(`Tunnel '${name}' tersimpan (port: ${port})`)
      return
    }

    if (sub === 'delete') {
      const name = args[2]
      if (!name) { logger.error('Nama tunnel wajib diisi'); process.exit(1) }
      const ok = deleteTunnel(name)
      if (ok) logger.info(`Tunnel '${name}' dihapus`)
      else logger.warn(`Tunnel '${name}' tidak ditemukan`)
      return
    }

    if (sub === 'run') {
      const name = args[2]
      if (!name) { logger.error('Nama tunnel wajib diisi'); process.exit(1) }
      const { getTunnel } = await import('../src/config.js')
      const t = getTunnel(name)
      if (!t) { logger.error(`Tunnel '${name}' tidak ditemukan`); process.exit(1) }
      try {
        const tunnel = await startTunnel({ port: t.port, token: t.token, name })
        console.log(`\n  Port    : ${t.port}`)
        if (tunnel.url) console.log(`  URL     : ${COLORS.info}${tunnel.url}${COLORS.reset}`)
        console.log(`\n  Tekan Ctrl+C untuk stop\n`)
        process.on('SIGINT', () => { tunnel.stop(); process.exit(0) })
      } catch (err) { logger.error(err.message); process.exit(1) }
      return
    }
    return
  }

  if (command === 'service') {
    if (!sub || sub === 'status') {
      const s = getServiceStatus()
      console.log(`Status service: ${s === 'running' ? COLORS.info : COLORS.warn}${s}${COLORS.reset}`)
      return
    }
    if (sub === 'install') {
      const port = parseInt(flags.port) || 3000
      const token = flags.token || null
      try { await installService({ port, token }) }
      catch (err) { logger.error(err.message); process.exit(1) }
      return
    }
    if (sub === 'uninstall') {
      try { await uninstallService() }
      catch (err) { logger.error(err.message); process.exit(1) }
      return
    }
    return
  }

  if (command === 'health') {
    const port = parseInt(flags.port) || 3000
    const ok = await healthCheck(port)
    process.exit(ok ? 0 : 1)
    return
  }

  if (command === 'log') {
    if (!existsSync(LOG_PATH)) { console.log('Belum ada log.'); return }
    const lines = parseInt(flags.lines) || 50
    const content = readFileSync(LOG_PATH, 'utf8').trim().split('\n')
    console.log(content.slice(-lines).join('\n'))

    if (flags.follow) {
      const { watch } = await import('fs')
      let lastSize = content.length
      watch(LOG_PATH, () => {
        const newContent = readFileSync(LOG_PATH, 'utf8').trim().split('\n')
        const newLines = newContent.slice(lastSize)
        if (newLines.length > 0) console.log(newLines.join('\n'))
        lastSize = newContent.length
      })
      process.on('SIGINT', () => process.exit(0))
    }
    return
  }

  if (command === 'dashboard') {
    startDashboard()
    return
  }

  if (command === 'status') {
    const s = getStatus()
    if (s.installed) {
      console.log(`${COLORS.info}✓ cloudflared terinstall${COLORS.reset}`)
      console.log(`  Versi   : ${s.version || 'unknown'}`)
      console.log(`  Path    : ${s.binaryPath}`)
    } else {
      console.log(`${COLORS.error}✗ cloudflared belum terinstall${COLORS.reset}`)
      console.log(`  Jalankan: autoflared install`)
    }
    return
  }

  if (command === 'config') {
    if (!sub || sub === 'show') {
      const config = getConfig()
      console.log(`\n${COLORS.bold}Config saat ini:${COLORS.reset}`)
      Object.entries(config).forEach(([k, v]) => console.log(`  ${k}: ${COLORS.info}${v}${COLORS.reset}`))
      console.log()
      return
    }
    if (sub === 'set') {
      const key = args[2]
      const value = args[3]
      if (!key || value === undefined) { logger.error('Usage: autoflared config set <key> <value>'); process.exit(1) }
      const parsed = value === 'true' ? true : value === 'false' ? false : isNaN(value) ? value : Number(value)
      setConfig(key, parsed)
      logger.info(`Config diupdate: ${key} = ${parsed}`)
      return
    }
    return
  }

  logger.error(`Command tidak dikenal: ${command}`)
  printHelp()
  process.exit(1)
}

main()
