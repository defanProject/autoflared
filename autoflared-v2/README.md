# autoflared v2

Auto install dan manage Cloudflare Tunnel (cloudflared) — zero config, langsung jalan.

## Fitur
- ✅ Auto install binary cloudflared (Linux/Mac/Windows)
- ✅ Auto update binary
- ✅ Quick tunnel (tanpa akun)
- ✅ Named tunnel dengan token
- ✅ Named tunnel manager (save/load/delete)
- ✅ Daemon/service mode (systemd, launchd, Windows Service)
- ✅ Health check port sebelum tunnel
- ✅ File logging dengan auto-rotate
- ✅ Live CLI dashboard
- ✅ Config manager

## Install

```bash
npm install -g autoflared
```

## CLI

```bash
# Install binary
autoflared install

# Quick tunnel
autoflared start --port 3000

# Named tunnel + auto restart
autoflared start --port 3000 --name myapp --auto-restart

# Simpan tunnel config
autoflared tunnel save myapp --port 3000 --token YOUR_TOKEN

# Jalankan tunnel tersimpan
autoflared tunnel run myapp

# Lihat semua tunnel tersimpan
autoflared tunnel list

# Hapus tunnel
autoflared tunnel delete myapp

# Install sebagai system service (auto start on boot)
autoflared service install --port 3000
autoflared service status
autoflared service uninstall

# Health check
autoflared health --port 3000

# Log
autoflared log --lines 100
autoflared log --follow

# Live dashboard
autoflared dashboard

# Status
autoflared status

# Update binary
autoflared update

# Config
autoflared config show
autoflared config set defaultPort 8080
autoflared config set logLevel debug
autoflared config set logMaxSizeMB 20
```

## Programmatic

```js
import { startTunnel, install, healthCheck } from 'autoflared'

await install()

const ok = await healthCheck(3000)
if (!ok) console.log('Port 3000 tidak aktif!')

const tunnel = await startTunnel({
  port: 3000,
  name: 'myapp',
  autoRestart: true
})

console.log(tunnel.url) // https://xxx.trycloudflare.com
tunnel.stop()
```

## Config Keys

| Key | Default | Keterangan |
|-----|---------|------------|
| defaultPort | 3000 | Port default |
| logLevel | info | debug/info/warn/error |
| logMaxSizeMB | 10 | Max ukuran log sebelum rotate |
| healthCheckTimeout | 5000 | Timeout health check (ms) |
| autoRestart | false | Auto restart tunnel |

## Platform

| OS | x64 | arm64 | arm |
|----|-----|-------|-----|
| Linux | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | - |
| Windows | ✅ | - | - |

## License
MIT — by depstore
