import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  EnvironmentCredentialBackend,
  EncryptedFileCredentialBackend,
  CredentialManager,
} from '../credentials.js';
import type {
  Credential,
  CredentialBackend,
  PasswordCredential,
  TokenCredential,
  KeyPairCredential,
  ServiceAccountCredential,
  DsnCredential,
} from '../credentials.js';

// ---------------------------------------------------------------------------
// EnvironmentCredentialBackend
// ---------------------------------------------------------------------------

describe('EnvironmentCredentialBackend', () => {
  const backend = new EnvironmentCredentialBackend();

  afterEach(() => {
    delete process.env['MDB_CONN_MYDB_PASSWORD'];
    delete process.env['MDB_CONN_MYDB_DSN'];
    delete process.env['MDB_CONN_MYDB_TOKEN'];
    delete process.env['MDB_CONN_MYDB_KEY_FILE'];
    delete process.env['MDB_CONN_PROD_DB_PASSWORD'];
  });

  it('is always available', async () => {
    expect(await backend.isAvailable()).toBe(true);
  });

  it('returns undefined when no env vars set', async () => {
    expect(await backend.get('mydb')).toBeUndefined();
  });

  it('resolves PASSWORD env var', async () => {
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'secret123';
    const cred = await backend.get('mydb');
    expect(cred).toEqual({ kind: 'password', password: 'secret123' });
  });

  it('resolves DSN env var (takes priority over PASSWORD)', async () => {
    process.env['MDB_CONN_MYDB_DSN'] = 'postgresql://user:pass@host/db';
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'secret123';
    const cred = await backend.get('mydb');
    expect(cred).toEqual({ kind: 'dsn', dsn: 'postgresql://user:pass@host/db' });
  });

  it('resolves TOKEN env var', async () => {
    process.env['MDB_CONN_MYDB_TOKEN'] = 'eyJhbGciOiJSUzI1NiJ9.test';
    const cred = await backend.get('mydb') as TokenCredential;
    expect(cred.kind).toBe('token');
    expect(cred.accessToken).toBe('eyJhbGciOiJSUzI1NiJ9.test');
  });

  it('resolves KEY_FILE env var', async () => {
    process.env['MDB_CONN_MYDB_KEY_FILE'] = '/path/to/key.json';
    const cred = await backend.get('mydb') as ServiceAccountCredential;
    expect(cred.kind).toBe('service-account');
    expect(cred.keyFilePath).toBe('/path/to/key.json');
  });

  it('converts hyphens to underscores in connection name', async () => {
    process.env['MDB_CONN_PROD_DB_PASSWORD'] = 'secret';
    const cred = await backend.get('prod-db');
    expect(cred).toEqual({ kind: 'password', password: 'secret' });
  });

  it('lists all connection names from env', async () => {
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'x';
    process.env['MDB_CONN_PROD_DB_DSN'] = 'y';
    const names = await backend.list();
    expect(names).toContain('mydb');
    expect(names).toContain('prod-db');
  });

  it('throws on store attempt', async () => {
    await expect(backend.store('x', { kind: 'password', password: 'y' })).rejects.toThrow(
      'Cannot write credentials to environment variables',
    );
  });
});

// ---------------------------------------------------------------------------
// EncryptedFileCredentialBackend
// ---------------------------------------------------------------------------

describe('EncryptedFileCredentialBackend', () => {
  const testDir = join(tmpdir(), `mdb-cred-test-${Date.now()}`);
  const credFile = join(testDir, 'credentials.enc');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  function createBackend(masterPassword = ''): EncryptedFileCredentialBackend {
    return new EncryptedFileCredentialBackend({ filePath: credFile, masterPassword });
  }

  it('is always available', async () => {
    expect(await createBackend().isAvailable()).toBe(true);
  });

  it('returns undefined when no file exists', async () => {
    expect(await createBackend().get('mydb')).toBeUndefined();
  });

  it('round-trips a password credential', async () => {
    const backend = createBackend('mypassword');
    const cred: PasswordCredential = { kind: 'password', password: 'db-secret-123' };

    await backend.store('mydb', cred);
    const retrieved = await backend.get('mydb');
    expect(retrieved).toEqual(cred);
  });

  it('round-trips a token credential', async () => {
    const backend = createBackend();
    const cred: TokenCredential = {
      kind: 'token',
      accessToken: 'access_abc',
      refreshToken: 'refresh_xyz',
      expiresAt: '2026-04-07T12:00:00Z',
    };

    await backend.store('snowflake-prod', cred);
    expect(await backend.get('snowflake-prod')).toEqual(cred);
  });

  it('round-trips a key-pair credential', async () => {
    const backend = createBackend();
    const cred: KeyPairCredential = {
      kind: 'key-pair',
      privateKeyPath: '/home/user/.ssh/snowflake_rsa',
      passphrase: 'key-passphrase',
    };

    await backend.store('sf', cred);
    expect(await backend.get('sf')).toEqual(cred);
  });

  it('round-trips a DSN credential', async () => {
    const backend = createBackend();
    const cred: DsnCredential = { kind: 'dsn', dsn: 'postgresql://user:pass@host:5432/db' };

    await backend.store('pg-prod', cred);
    expect(await backend.get('pg-prod')).toEqual(cred);
  });

  it('stores multiple credentials independently', async () => {
    const backend = createBackend();
    await backend.store('a', { kind: 'password', password: 'pw-a' });
    await backend.store('b', { kind: 'password', password: 'pw-b' });

    expect(await backend.get('a')).toEqual({ kind: 'password', password: 'pw-a' });
    expect(await backend.get('b')).toEqual({ kind: 'password', password: 'pw-b' });
  });

  it('overwrites existing credential on re-store', async () => {
    const backend = createBackend();
    await backend.store('x', { kind: 'password', password: 'old' });
    await backend.store('x', { kind: 'password', password: 'new' });
    expect(await backend.get('x')).toEqual({ kind: 'password', password: 'new' });
  });

  it('deletes a credential', async () => {
    const backend = createBackend();
    await backend.store('todelete', { kind: 'password', password: 'bye' });
    expect(await backend.delete('todelete')).toBe(true);
    expect(await backend.get('todelete')).toBeUndefined();
  });

  it('returns false when deleting non-existent credential', async () => {
    const backend = createBackend();
    expect(await backend.delete('nope')).toBe(false);
  });

  it('lists stored connection names', async () => {
    const backend = createBackend();
    await backend.store('alpha', { kind: 'password', password: '1' });
    await backend.store('beta', { kind: 'password', password: '2' });
    const names = await backend.list();
    expect(names.sort()).toEqual(['alpha', 'beta']);
  });

  it('fails to decrypt with wrong master password', async () => {
    const right = createBackend('correct-password');
    await right.store('secured', { kind: 'password', password: 'secret' });

    const wrong = createBackend('wrong-password');
    await expect(wrong.get('secured')).rejects.toThrow('Failed to decrypt credentials');
  });

  it('writes file with 0600 permissions on unix', async () => {
    const backend = createBackend();
    await backend.store('perm-test', { kind: 'password', password: 'x' });

    if (process.platform !== 'win32') {
      const { statSync } = await import('node:fs');
      const stats = statSync(credFile);
      // 0o600 = owner read+write only
      expect(stats.mode & 0o777).toBe(0o600);
    }
  });

  it('encrypted file is not plaintext-readable', async () => {
    const backend = createBackend();
    await backend.store('secret-conn', { kind: 'password', password: 'super-secret' });

    const raw = readFileSync(credFile, 'utf8');
    expect(raw).not.toContain('super-secret');
    expect(raw).not.toContain('"password"');
    // But it should be valid JSON (the envelope structure)
    const envelope = JSON.parse(raw);
    expect(envelope.version).toBe(1);
    expect(envelope.salt).toBeDefined();
    expect(envelope.credentials['secret-conn']).toBeDefined();
    expect(envelope.credentials['secret-conn'].iv).toBeDefined();
    expect(envelope.credentials['secret-conn'].tag).toBeDefined();
    expect(envelope.credentials['secret-conn'].data).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CredentialManager (resolution chain)
// ---------------------------------------------------------------------------

describe('CredentialManager', () => {
  const testDir = join(tmpdir(), `mdb-credmgr-test-${Date.now()}`);
  const credFile = join(testDir, 'credentials.enc');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    delete process.env['MDB_CONN_MYDB_PASSWORD'];
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  function createManager(extraBackends?: CredentialBackend[]): CredentialManager {
    const backends: CredentialBackend[] = [
      new EnvironmentCredentialBackend(),
      ...(extraBackends ?? []),
      new EncryptedFileCredentialBackend({ filePath: credFile }),
    ];
    return new CredentialManager({ backends });
  }

  it('resolves env var credential first', async () => {
    const mgr = createManager();
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'from-env';
    await new EncryptedFileCredentialBackend({ filePath: credFile })
      .store('mydb', { kind: 'password', password: 'from-file' });

    const cred = await mgr.get('mydb');
    expect(cred).toEqual({ kind: 'password', password: 'from-env' });
  });

  it('falls through to encrypted file when env not set', async () => {
    const mgr = createManager();
    await new EncryptedFileCredentialBackend({ filePath: credFile })
      .store('mydb', { kind: 'password', password: 'from-file' });

    const cred = await mgr.get('mydb');
    expect(cred).toEqual({ kind: 'password', password: 'from-file' });
  });

  it('returns undefined when no backend has the credential', async () => {
    const mgr = createManager();
    expect(await mgr.get('nonexistent')).toBeUndefined();
  });

  it('stores to first writable backend (skips env)', async () => {
    const mgr = createManager();
    await mgr.store('newconn', { kind: 'password', password: 'stored' });

    // Should be in encrypted file, not in env
    expect(process.env['MDB_CONN_NEWCONN_PASSWORD']).toBeUndefined();
    const fileCred = await new EncryptedFileCredentialBackend({ filePath: credFile }).get('newconn');
    expect(fileCred).toEqual({ kind: 'password', password: 'stored' });
  });

  it('deletes from all backends', async () => {
    const mgr = createManager();
    await mgr.store('del-test', { kind: 'password', password: 'bye' });
    expect(await mgr.delete('del-test')).toBe(true);
    expect(await mgr.get('del-test')).toBeUndefined();
  });

  it('lists credentials across all backends', async () => {
    const mgr = createManager();
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'x';
    await new EncryptedFileCredentialBackend({ filePath: credFile })
      .store('fileconn', { kind: 'password', password: 'y' });

    const names = await mgr.list();
    expect(names).toContain('mydb');
    expect(names).toContain('fileconn');
  });

  it('locateBackend returns correct backend name', async () => {
    const mgr = createManager();
    process.env['MDB_CONN_MYDB_PASSWORD'] = 'x';
    await new EncryptedFileCredentialBackend({ filePath: credFile })
      .store('fileconn', { kind: 'password', password: 'y' });

    expect(await mgr.locateBackend('mydb')).toBe('environment');
    expect(await mgr.locateBackend('fileconn')).toBe('encrypted-file');
    expect(await mgr.locateBackend('nope')).toBeUndefined();
  });

  it('supports custom backend in chain', async () => {
    const customBackend: CredentialBackend = {
      name: 'custom-vault',
      isAvailable: async () => true,
      get: async (name) => name === 'vault-conn' ? { kind: 'password', password: 'vault-secret' } : undefined,
      store: async () => {},
      delete: async () => false,
      list: async () => ['vault-conn'],
    };

    const mgr = createManager([customBackend]);
    const cred = await mgr.get('vault-conn');
    expect(cred).toEqual({ kind: 'password', password: 'vault-secret' });
    expect(await mgr.locateBackend('vault-conn')).toBe('custom-vault');
  });
});
