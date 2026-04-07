import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../registry.js';
import type { DriverAdapter } from '../driver-adapter.js';

const mockAdapter = { dialect: 'sqlite' } as DriverAdapter;

describe('PluginRegistry', () => {
  it('registers and retrieves an adapter', async () => {
    const reg = new PluginRegistry();
    reg.register('sqlite', mockAdapter);
    expect(await reg.get('sqlite')).toBe(mockAdapter);
  });

  it('lazy-loads via factory', async () => {
    const reg = new PluginRegistry();
    let called = false;
    reg.registerFactory('sqlite', async () => {
      called = true;
      return mockAdapter;
    });
    expect(called).toBe(false);
    const adapter = await reg.get('sqlite');
    expect(called).toBe(true);
    expect(adapter).toBe(mockAdapter);
  });

  it('caches after first factory call', async () => {
    const reg = new PluginRegistry();
    let count = 0;
    reg.registerFactory('sqlite', async () => {
      count++;
      return mockAdapter;
    });
    await reg.get('sqlite');
    await reg.get('sqlite');
    expect(count).toBe(1);
  });

  it('throws for unknown dialect', async () => {
    const reg = new PluginRegistry();
    await expect(reg.get('postgresql')).rejects.toThrow('No driver registered');
  });

  it('lists registered dialects', () => {
    const reg = new PluginRegistry();
    reg.register('sqlite', mockAdapter);
    reg.registerFactory('postgresql', async () => mockAdapter);
    expect(reg.dialects).toContain('sqlite');
    expect(reg.dialects).toContain('postgresql');
  });

  it('has() returns correct values', () => {
    const reg = new PluginRegistry();
    expect(reg.has('sqlite')).toBe(false);
    reg.register('sqlite', mockAdapter);
    expect(reg.has('sqlite')).toBe(true);
  });
});
