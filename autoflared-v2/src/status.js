import { getBinaryPath, getCurrentVersion } from './installer.js'

export function getStatus() {
  const binaryPath = getBinaryPath()
  if (!binaryPath) return { installed: false, version: null, binaryPath: null }
  const version = getCurrentVersion()
  return { installed: true, version, binaryPath }
}
