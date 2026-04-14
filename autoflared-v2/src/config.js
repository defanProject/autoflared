import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export const BASE_DIR = join(homedir(), '.autoflared')
export const CONFIG_PATH = join(BASE_DIR, 'config.json')
export const TUNNELS_PATH = join(BASE_DIR, 'tunnels.json')
export const LOG_PATH = join(BASE_DIR, 'autoflared.log')
export const BINARY_PATH = join(BASE_DIR, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')

const DEFAULT_CONFIG = {
  defaultPort: 3000,
  autoRestart: false,
  logLevel: 'info',
  logMaxSizeMB: 10,
  healthCheckTimeout: 5000,
  updateChannel: 'latest'
}

function ensureDir() {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true })
}

export function getConfig() {
  ensureDir()
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return { ...DEFAULT_CONFIG }
  }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function setConfig(key, value) {
  ensureDir()
  const config = getConfig()
  config[key] = value
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  return config
}

export function getTunnels() {
  ensureDir()
  if (!existsSync(TUNNELS_PATH)) {
    writeFileSync(TUNNELS_PATH, JSON.stringify({}, null, 2))
    return {}
  }
  try {
    return JSON.parse(readFileSync(TUNNELS_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export function saveTunnel(name, data) {
  ensureDir()
  const tunnels = getTunnels()
  tunnels[name] = { ...data, updatedAt: new Date().toISOString() }
  writeFileSync(TUNNELS_PATH, JSON.stringify(tunnels, null, 2))
  return tunnels[name]
}

export function deleteTunnel(name) {
  const tunnels = getTunnels()
  if (!tunnels[name]) return false
  delete tunnels[name]
  writeFileSync(TUNNELS_PATH, JSON.stringify(tunnels, null, 2))
  return true
}

export function getTunnel(name) {
  const tunnels = getTunnels()
  return tunnels[name] || null
}
