import { execSync } from 'child_process'
import { existsSync, mkdirSync, chmodSync, createWriteStream, unlinkSync } from 'fs'
import { BASE_DIR, BINARY_PATH } from './config.js'
import { logger } from './logger.js'
import https from 'https'
import http from 'http'

const DOWNLOAD_URLS = {
  linux: {
    x64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
    arm64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64',
    arm: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm'
  },
  darwin: {
    x64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
    arm64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz'
  },
  win32: {
    x64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  }
}

function getDownloadUrl() {
  const platform = process.platform
  const arch = process.arch
  const urls = DOWNLOAD_URLS[platform]
  if (!urls) throw new Error(`Platform ${platform} tidak didukung`)
  const url = urls[arch]
  if (!url) throw new Error(`Arsitektur ${arch} di ${platform} tidak didukung`)
  return url
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http
    let downloaded = 0

    const request = (targetUrl) => {
      const mod = targetUrl.startsWith('https') ? https : http
      mod.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          return request(res.headers.location)
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download gagal: HTTP ${res.statusCode}`))
          return
        }

        const total = parseInt(res.headers['content-length'] || '0')

        res.on('data', (chunk) => {
          downloaded += chunk.length
          if (total > 0) {
            const pct = Math.floor((downloaded / total) * 100)
            process.stdout.write(`\r  Progress: ${pct}% (${Math.floor(downloaded / 1024)}KB)`)
          }
        })

        res.pipe(file)
        file.on('finish', () => {
          process.stdout.write('\n')
          file.close(resolve)
        })
      }).on('error', reject)
    }

    request(url)
  })
}

export function getBinaryPath() {
  if (existsSync(BINARY_PATH)) return BINARY_PATH
  try {
    const which = process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared'
    const result = execSync(which, { stdio: 'pipe' }).toString().trim()
    if (result) return result
  } catch {}
  return null
}

export function getCurrentVersion() {
  const bin = getBinaryPath()
  if (!bin) return null
  try {
    return execSync(`"${bin}" --version`, { stdio: 'pipe' })
      .toString().trim().replace('cloudflared version ', '').split(' ')[0]
  } catch { return null }
}

export async function install(options = {}) {
  const { force = false } = options

  if (existsSync(BINARY_PATH) && !force) {
    logger.info('cloudflared sudah terinstall, skip. Gunakan --force untuk reinstall')
    return BINARY_PATH
  }

  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true })

  const url = getDownloadUrl()
  logger.info(`Mengunduh cloudflared untuk ${process.platform}/${process.arch}...`)

  const tmpPath = BINARY_PATH + '.tmp'
  await downloadFile(url, tmpPath)

  if (existsSync(BINARY_PATH)) {
    try { unlinkSync(BINARY_PATH) } catch {}
  }

  const { renameSync } = await import('fs')
  renameSync(tmpPath, BINARY_PATH)

  if (process.platform !== 'win32') chmodSync(BINARY_PATH, '755')

  const version = getCurrentVersion()
  logger.info(`cloudflared v${version} berhasil diinstall di: ${BINARY_PATH}`)
  return BINARY_PATH
}

export async function update() {
  const oldVersion = getCurrentVersion()
  logger.info(`Versi saat ini: ${oldVersion || 'tidak diketahui'}`)
  logger.info('Mengunduh versi terbaru...')
  await install({ force: true })
  const newVersion = getCurrentVersion()
  if (oldVersion === newVersion) {
    logger.info(`Sudah versi terbaru: ${newVersion}`)
  } else {
    logger.info(`Update selesai: ${oldVersion} → ${newVersion}`)
  }
}
