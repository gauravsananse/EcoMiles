const { spawn } = require('child_process');

class TunnelService {
  constructor() {
    this.tunnelUrl = process.env.MOBILE_TUNNEL_URL || null;
    this.process = null;
    this.isStarting = false;
    this.retryTimeout = null;
  }

  startTunnel(port = 5173) {
    if (this.tunnelUrl || this.isStarting) return;
    this.isStarting = true;

    this.spawnLocalhostRun(port);
  }

  spawnLocalhostRun(port) {
    try {
      console.log('[TunnelService] 🚀 Initializing zero-password HTTPS tunnel (localhost.run)...');
      
      // nokey@localhost.run requires NO password or account
      // -o BatchMode=yes prevents any password/passphrase prompt from blocking the process
      this.process = spawn('ssh', [
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ConnectTimeout=10',
        '-R', `80:localhost:${port}`,
        'nokey@localhost.run'
      ]);

      const handleData = (data) => {
        const str = data.toString();
        const match = str.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
        if (match) {
          this.tunnelUrl = match[0];
          this.isStarting = false;
          console.log(`[TunnelService] 🌐 Public Mobile HTTPS URL: ${this.tunnelUrl}`);
        }
      };

      if (this.process.stdout) this.process.stdout.on('data', handleData);
      if (this.process.stderr) this.process.stderr.on('data', handleData);

      this.process.on('close', () => {
        this.tunnelUrl = null;
        this.isStarting = false;
        this.process = null;
        this.scheduleRetry(port);
      });

      this.process.on('error', (err) => {
        console.warn('[TunnelService] Tunnel unavailable:', err.message);
        this.tunnelUrl = null;
        this.isStarting = false;
      });
    } catch (err) {
      console.warn('[TunnelService] Failed to start tunnel:', err.message);
      this.isStarting = false;
    }
  }

  scheduleRetry(port) {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = setTimeout(() => {
      if (!this.tunnelUrl && !this.isStarting) {
        this.startTunnel(port);
      }
    }, 15000);
  }

  getTunnelUrl() {
    return this.tunnelUrl;
  }
}

module.exports = new TunnelService();
