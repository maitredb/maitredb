import type { HookHandler, QueryHook } from './types.js';

export class HookRegistry {
  private readonly handlers: HookHandler[] = [];

  register(handler: HookHandler): void {
    this.handlers.push(handler);
  }

  async run(hook: QueryHook): Promise<void> {
    for (const handler of this.handlers) {
      await handler(hook);
    }
  }
}
