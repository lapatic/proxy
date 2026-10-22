// Overrides for Rammerhead's src/config.js (it loads ../config.js automatically).
// Rammerhead is cloned into ./rammerhead by scripts/setup.sh; this file is copied into it.
const path = require('path');
const RammerheadJSMemCache = require('./src/classes/RammerheadJSMemCache.js');

module.exports = {
    bindingAddress: '0.0.0.0',
    port: 8080,
    // A single port: Codespaces gives every forwarded port its own hostname,
    // so the second "cross domain" port can't work there.
    crossDomainPort: null,
    enableWorkers: false,
    ssl: null,

    // Build proxied URLs from the address the browser actually used.
    // In a Codespace that is https://<name>-8080.app.github.dev (port 443 from the outside).
    getServerInfo: (req) => {
        const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:8080').split(',')[0].trim();
        const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        const url = new URL(proto + '://' + host);
        return {
            hostname: url.hostname,
            port: url.port ? Number(url.port) : proto === 'https' ? 443 : 80,
            crossDomainPort: null,
            protocol: proto + ':'
        };
    },

    // Optional: set PROXY_PASSWORD (Codespaces secret or env var) to require a password.
    password: process.env.PROXY_PASSWORD || null,

    // Codespaces' forwarder changes the client IP, so don't pin sessions to one.
    restrictSessionToIP: false,
    getIP: (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),

    jsCache: new RammerheadJSMemCache(50 * 1024 * 1024),
    fileCacheSessionConfig: {
        saveDirectory: path.join(__dirname, 'sessions'),
        cacheTimeout: 1000 * 60 * 20,
        cacheCheckInterval: 1000 * 60 * 10,
        deleteUnused: true,
        staleCleanupOptions: {
            staleTimeout: 1000 * 60 * 60 * 24 * 3,
            maxToLive: null,
            staleCheckInterval: 1000 * 60 * 60 * 6
        },
        deleteCorruptedSessions: true
    }
};
