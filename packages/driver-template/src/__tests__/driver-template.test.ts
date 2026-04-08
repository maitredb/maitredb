import { describe, expect, it } from 'vitest';
import { DRIVER_BOOTSTRAP_CHECKLIST, DriverTemplate } from '../index.js';

describe('DriverTemplate smoke test', () => {
  it('exports the checklist and default metadata', () => {
    const driver = new DriverTemplate();

    expect(driver.dialect).toBe('postgresql');
    expect(driver.capabilities()).toMatchObject({
      transactions: false,
      streaming: false,
      explain: false,
      explainAnalyze: false,
      procedures: false,
      userDefinedTypes: false,
      roles: false,
      schemas: false,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: false,
      costEstimate: false,
    });
    expect(DRIVER_BOOTSTRAP_CHECKLIST.length).toBeGreaterThan(0);
  });

  it('throws TODO errors for unimplemented template methods', async () => {
    const driver = new DriverTemplate();
    await expect(driver.connect({ name: 'tmpl', type: 'postgresql' })).rejects.toThrow(
      'TODO(driver): implement initializeNativeClient',
    );
  });
});
