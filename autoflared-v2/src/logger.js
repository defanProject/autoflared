import { appendFileSync, existsSync, statSync, renameSync, writeFileSync } from 'fs'
import { LOG_PATH } from './config.js'
import { getConfig } from './config.js'

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
}

function rotateLogs() {
  try {
    const config = getConfig()
    const maxBytes = (config.logMaxSizeMB || 10) * 1024 * 1024
    if (existsSync(LOG_PATH) && statSync(LOG_PATH).size > maxBytes) {
      renameSync(LOG_PATH, LOG_PATH + '.old')
      writeFileSync(LOG_PATH, '')
    }
  } catch {}
}

function writeLog(level, message) {
  rotateLogs()
  const ts = new Date().toISOString()
  const line = `[${ts}] [${level.toUpperCase()}] ${message}\n`
  try {
    appendFileSync(LOG_PATH, line)
  } catch {}
}

function shouldLog(level) {
  const config = getConfig()
  const configLevel = config.logLevel || 'info'
  return LEVELS[level] >= LEVELS[configLevel]
}

export const logger = {
  debug(msg) {
    if (!shouldLog('debug')) return
    const ts = new Date().toLocaleTimeString()
    console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${COLORS.debug}DEBUG${COLORS.reset} ${msg}`)
    writeLog('debug', msg)
  },
  info(msg) {
    if (!shouldLog('info')) return
    const ts = new Date().toLocaleTimeString()
    console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${COLORS.info}INFO${COLORS.reset}  ${msg}`)
    writeLog('info', msg)
  },
  warn(msg) {
    if (!shouldLog('warn')) return
    const ts = new Date().toLocaleTimeString()
    console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${COLORS.warn}WARN${COLORS.reset}  ${msg}`)
    writeLog('warn', msg)
  },
  error(msg) {
    if (!shouldLog('error')) return
    const ts = new Date().toLocaleTimeString()
    console.error(`${COLORS.dim}[${ts}]${COLORS.reset} ${COLORS.error}ERROR${COLORS.reset} ${msg}`)
    writeLog('error', msg)
  },
  raw(msg) {
    console.log(msg)
    writeLog('info', msg.replace(/\x1b\[[0-9;]*m/g, ''))
  }
}

export { COLORS }
