// Overrides for Rammerhead's src/config.js (it loads ../config.js automatically).
// Rammerhead is cloned into ./rammerhead by scripts/setup.sh; this file is copied into it.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const RammerheadJSMemCache = require('./src/classes/RammerheadJSMemCache.js');
const RammerheadSession = require('./src/classes/RammerheadSession.js');
const RammerheadSessionFileCache = require('./src/classes/RammerheadSessionFileCache.js');

// ---- Secrets -------------------------------------------------------------------------------
// Both live next to this file (inside the git-ignored rammerhead/ folder), mode 0600.
function loadOrCreateSecret(name, make) {
    const file = path.join(__dirname, name);
    try {
        return fs.readFileSync(file, 'utf8').trim();
    } catch (e) {
        const value = make();
        fs.writeFileSync(file, value + '\n', { mode: 0o600 });
        return value;
    }
}
// Password for creating/editing/deleting sessions. PROXY_PASSWORD wins; otherwise a random one
// is generated once and kept in rammerhead/.proxy-password (scripts/start.sh prints it).
const password = process.env.PROXY_PASSWORD || loadOrCreateSecret('.proxy-password', () => crypto.randomBytes(12).toString('base64url'));
// Key that encrypts session files at rest. Separate from the password so changing the
// password does not destroy saved sessions.
const sessionKey = Buffer.from(loadOrCreateSecret('.session-key', () => crypto.randomBytes(32).toString('hex')), 'hex');

// ---- Encrypt sessions at rest --------------------------------------------------------------
// Session files hold cookies and logins. They are stored as AES-256-GCM ciphertext, and the file
// name is an HMAC of the session id, so neither the contents nor the ids can be read off disk.
const PREFIX = 'RHENC1:';
const HASHED_ID = /^h[0-9a-f]{64}$/;

function encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}
function decrypt(data) {
    const text = data.toString();
    if (!text.startsWith(PREFIX)) return text; // old unencrypted file; re-saved encrypted next write
    try {
        const raw = Buffer.from(text.slice(PREFIX.length), 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    } catch (e) {
        // Rammerhead deletes session files that throw a JSON SyntaxError (tampered/wrong key).
        throw new SyntaxError('JSON: session file failed decryption');
    }
}

const origSerialize = RammerheadSession.prototype.serializeSession;
RammerheadSession.prototype.serializeSession = function () {
    return encrypt(origSerialize.call(this));
};
const origDeserialize = RammerheadSession.DeserializeSession;
RammerheadSession.DeserializeSession = function (id, serialized) {
    return origDeserialize.call(this, id, decrypt(serialized));
};
// Ids that are already hashed (from keysStore, used by the stale-session sweep) pass through.
RammerheadSessionFileCache.prototype._getSessionFilePath = function (id) {
    const name = HASHED_ID.test(id)
        ? id
        : 'h' + crypto.createHmac('sha256', sessionKey).update(String(id)).digest('hex');
    return path.join(this.saveDirectory, name + '.rhfsession');
};

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

    // Always required: PROXY_PASSWORD, or a generated one (see top of file).
    password,

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
