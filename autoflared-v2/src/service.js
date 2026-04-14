import { execSync, exec } from 'child_process'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { BINARY_PATH, BASE_DIR } from './config.js'
import { logger } from './logger.js'

const SERVICE_NAME = 'autoflared'

function isLinux() { return process.platform === 'linux' }
function isMac() { return process.platform === 'darwin' }
function isWindows() { return process.platform === 'win32' }

function hasSystemd() {
  try { execSync('systemctl --version', { stdio: 'pipe' }); return true } catch { return false }
}

export async function installService(options = {}) {
  const { port = 3000, token = null } = options
  const args = token
    ? `tunnel --no-autoupdate run --token ${token}`
    : `tunnel --no-autoupdate --url http://localhost:${port}`

  if (isLinux() && hasSystemd()) {
    return installSystemd(args)
  } else if (isMac()) {
    return installLaunchd(args, port)
  } else if (isWindows()) {
    return installWindowsService(args)
  } else {
    throw new Error('Service mode tidak didukung di platform ini')
  }
}

function installSystemd(args) {
  const serviceContent = `[Unit]
Description=Autoflared Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=${BINARY_PATH} ${args}
Restart=always
RestartSec=5
User=${process.env.USER || 'root'}

[Install]
WantedBy=multi-user.target
`
  const servicePath = `/etc/systemd/system/${SERVICE_NAME}.service`
  try {
    writeFileSync('/tmp/autoflared.service', serviceContent)
    execSync(`sudo mv /tmp/autoflared.service ${servicePath}`)
    execSync(`sudo systemctl daemon-reload`)
    execSync(`sudo systemctl enable ${SERVICE_NAME}`)
    execSync(`sudo systemctl start ${SERVICE_NAME}`)
    logger.info(`✓ Systemd service terinstall dan berjalan`)
    logger.info(`  Kelola: sudo systemctl [start|stop|restart|status] ${SERVICE_NAME}`)
  } catch (err) {
    throw new Error(`Gagal install systemd service: ${err.message}`)
  }
}

function installLaunchd(args, port) {
  const plistPath = join(homedir(), `Library/LaunchAgents/com.autoflared.tunnel.plist`)
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.autoflared.tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>${BINARY_PATH}</string>
    ${args.split(' ').map(a => `<string>${a}</string>`).join('\n    ')}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${BASE_DIR}/autoflared.log</string>
  <key>StandardErrorPath</key>
  <string>${BASE_DIR}/autoflared.log</string>
</dict>
</plist>`
  writeFileSync(plistPath, plistContent)
  try {
    execSync(`launchctl load ${plistPath}`)
    logger.info(`✓ LaunchAgent terinstall`)
    logger.info(`  Kelola: launchctl [load|unload] ${plistPath}`)
  } catch (err) {
    throw new Error(`Gagal install launchd: ${err.message}`)
  }
}

function installWindowsService(args) {
  try {
    execSync(`"${BINARY_PATH}" service install`, { stdio: 'pipe' })
    logger.info(`✓ Windows service terinstall`)
    logger.info(`  Kelola: sc [start|stop] ${SERVICE_NAME}`)
  } catch (err) {
    throw new Error(`Gagal install Windows service: ${err.message}`)
  }
}

export async function uninstallService() {
  if (isLinux() && hasSystemd()) {
    try {
      execSync(`sudo systemctl stop ${SERVICE_NAME}`, { stdio: 'pipe' })
      execSync(`sudo systemctl disable ${SERVICE_NAME}`, { stdio: 'pipe' })
      execSync(`sudo rm -f /etc/systemd/system/${SERVICE_NAME}.service`)
      execSync(`sudo systemctl daemon-reload`)
      logger.info(`✓ Service berhasil dihapus`)
    } catch (err) {
      throw new Error(`Gagal hapus service: ${err.message}`)
    }
  } else if (isMac()) {
    const plistPath = join(homedir(), `Library/LaunchAgents/com.autoflared.tunnel.plist`)
    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: 'pipe' })
      execSync(`rm -f ${plistPath}`)
      logger.info(`✓ LaunchAgent berhasil dihapus`)
    } catch (err) {
      throw new Error(`Gagal hapus launchd: ${err.message}`)
    }
  } else if (isWindows()) {
    try {
      execSync(`"${BINARY_PATH}" service uninstall`, { stdio: 'pipe' })
      logger.info(`✓ Windows service berhasil dihapus`)
    } catch (err) {
      throw new Error(`Gagal hapus Windows service: ${err.message}`)
    }
  }
}

export function getServiceStatus() {
  try {
    if (isLinux() && hasSystemd()) {
      const out = execSync(`systemctl is-active ${SERVICE_NAME}`, { stdio: 'pipe' }).toString().trim()
      return out === 'active' ? 'running' : 'stopped'
    } else if (isMac()) {
      const plistPath = join(homedir(), `Library/LaunchAgents/com.autoflared.tunnel.plist`)
      return existsSync(plistPath) ? 'installed' : 'not installed'
    } else if (isWindows()) {
      const out = execSync(`sc query ${SERVICE_NAME}`, { stdio: 'pipe' }).toString()
      return out.includes('RUNNING') ? 'running' : 'stopped'
    }
  } catch {}
  return 'unknown'
}
