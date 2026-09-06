import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
class TunnelService {
    process = null;
    currentStatus = {
        status: 'stopped',
        url: null,
        error: null
    };
    listeners = [];
    getStatus() {
        return this.currentStatus;
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
    notify() {
        this.listeners.forEach((l) => l(this.currentStatus));
    }
    findCloudflaredPath() {
        // Check project root directory
        const rootPath = path.resolve(process.cwd(), 'cloudflared.exe');
        if (fs.existsSync(rootPath))
            return rootPath;
        // Check parent or relative paths
        const localDir = path.resolve(__dirname, '../../cloudflared.exe');
        if (fs.existsSync(localDir))
            return localDir;
        // Check Program Files default install
        const progFiles = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
        if (fs.existsSync(progFiles))
            return progFiles;
        const progFiles64 = 'C:\\Program Files\\cloudflared\\cloudflared.exe';
        if (fs.existsSync(progFiles64))
            return progFiles64;
        // Default to 'cloudflared' in PATH
        return 'cloudflared';
    }
    async start(port = 3000) {
        if (this.process && this.currentStatus.status === 'running') {
            return this.currentStatus;
        }
        this.stop();
        this.currentStatus = {
            status: 'starting',
            url: null,
            error: null
        };
        this.notify();
        const binPath = this.findCloudflaredPath();
        if (!binPath) {
            this.currentStatus = {
                status: 'error',
                url: null,
                error: 'cloudflared.exe не найден на компьютере'
            };
            this.notify();
            return this.currentStatus;
        }
        return new Promise((resolve) => {
            try {
                const args = ['tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`];
                const child = spawn(binPath, args, {
                    windowsHide: true,
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                this.process = child;
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        if (this.currentStatus.status === 'starting') {
                            this.currentStatus = {
                                status: 'error',
                                url: null,
                                error: 'Таймаут получения публичного адреса от Cloudflare'
                            };
                            this.notify();
                            resolve(this.currentStatus);
                        }
                    }
                }, 25000);
                const handleOutput = (data) => {
                    const text = data.toString();
                    // Find real trycloudflare.com link, ignoring api.trycloudflare.com
                    const matches = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
                    if (matches) {
                        for (const candidate of matches) {
                            if (!candidate.includes('api.trycloudflare.com') && !resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                this.currentStatus = {
                                    status: 'running',
                                    url: candidate,
                                    error: null
                                };
                                this.notify();
                                resolve(this.currentStatus);
                                break;
                            }
                        }
                    }
                };
                child.stdout?.on('data', handleOutput);
                child.stderr?.on('data', handleOutput);
                child.on('error', (err) => {
                    console.error('Cloudflared process error:', err);
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.currentStatus = {
                            status: 'error',
                            url: null,
                            error: 'Не удалось запустить cloudflared: ' + err.message
                        };
                        this.notify();
                        resolve(this.currentStatus);
                    }
                });
                child.on('close', (code) => {
                    this.process = null;
                    this.currentStatus = {
                        status: 'stopped',
                        url: null,
                        error: code !== 0 && code !== null ? `Процесс завершился с кодом ${code}` : null
                    };
                    this.notify();
                });
            }
            catch (err) {
                this.currentStatus = {
                    status: 'error',
                    url: null,
                    error: err.message || 'Ошибка запуска туннеля'
                };
                this.notify();
                resolve(this.currentStatus);
            }
        });
    }
    stop() {
        if (this.process) {
            try {
                this.process.kill('SIGTERM');
                // Force kill on Windows if still running
                if (process.platform === 'win32' && this.process.pid) {
                    spawn('taskkill', ['/pid', this.process.pid.toString(), '/f', '/t']);
                }
            }
            catch (e) {
                console.warn('Error stopping cloudflared process:', e);
            }
            this.process = null;
        }
        this.currentStatus = {
            status: 'stopped',
            url: null,
            error: null
        };
        this.notify();
        return this.currentStatus;
    }
}
export const tunnelService = new TunnelService();
// Clean up child process when node server exits
process.on('exit', () => tunnelService.stop());
process.on('SIGINT', () => {
    tunnelService.stop();
    process.exit();
});
process.on('SIGTERM', () => {
    tunnelService.stop();
    process.exit();
});
