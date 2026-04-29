import { createRequire } from 'node:module';

export interface NativeWireBinding {
  nativeAvailable?: () => boolean;
  parsePostgresBinary?: (...args: unknown[]) => ArrayBuffer | Uint8Array | Buffer;
  parsePostgresText?: (...args: unknown[]) => ArrayBuffer | Uint8Array | Buffer;
  parseMysqlBinary?: (...args: unknown[]) => ArrayBuffer | Uint8Array | Buffer;
}

const require = createRequire(import.meta.url);

export function loadNativeBinding(): NativeWireBinding | undefined {
  const packageName = platformPackageName();
  if (!packageName) return undefined;

  try {
    return require(packageName) as NativeWireBinding;
  } catch {
    return undefined;
  }
}

function platformPackageName(): string | undefined {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin' && arch === 'arm64') return '@maitredb/wire-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return '@maitredb/wire-darwin-x64';
  if (platform === 'linux' && arch === 'arm64') return '@maitredb/wire-linux-arm64-gnu';
  if (platform === 'linux' && arch === 'x64') return '@maitredb/wire-linux-x64-gnu';
  if (platform === 'win32' && arch === 'x64') return '@maitredb/wire-win32-x64-msvc';

  return undefined;
}