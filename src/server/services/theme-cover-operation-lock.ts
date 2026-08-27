import "server-only";

import { AppError } from "@/lib/errors";

type LockWaiter = {
  grant(): void;
  timeout: ReturnType<typeof setTimeout>;
};

type LockState = {
  waiters: LockWaiter[];
};

function busyCoverError() {
  return new AppError(
    "THEME_COVER_BUSY",
    "Outra criação está usando esta capa. Tente novamente.",
    409,
    { coverFile: ["Aguarde a outra criação terminar e tente novamente."] },
  );
}

export function createThemeCoverOperationLock({
  waitTimeoutMs,
}: {
  waitTimeoutMs: number;
}) {
  const locks = new Map<string, LockState>();

  function release(key: string, state: LockState) {
    const next = state.waiters.shift();
    if (next) {
      next.grant();
      return;
    }

    if (locks.get(key) === state) locks.delete(key);
  }

  async function acquire(key: string) {
    const active = locks.get(key);
    if (!active) {
      const state: LockState = { waiters: [] };
      locks.set(key, state);
      return () => release(key, state);
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: LockWaiter = {
        grant: () => {
          clearTimeout(waiter.timeout);
          resolve(() => release(key, active));
        },
        timeout: setTimeout(() => {
          const index = active.waiters.indexOf(waiter);
          if (index >= 0) active.waiters.splice(index, 1);
          reject(busyCoverError());
        }, waitTimeoutMs),
      };
      active.waiters.push(waiter);
    });
  }

  return async function withThemeCoverOperationLock<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const releaseLock = await acquire(key);
    try {
      return await operation();
    } finally {
      releaseLock();
    }
  };
}

export const withThemeCoverOperationLock = createThemeCoverOperationLock({
  waitTimeoutMs: 15_000,
});

function cleanupBusyError() {
  return new AppError(
    "THEME_COVER_CLEANUP_BUSY",
    "Outra compensação de capa está em andamento. Tente novamente.",
    409,
  );
}

export function createThemeCoverCleanupSlot() {
  let active = false;

  return async function withThemeCoverCleanupSlot<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (active) throw cleanupBusyError();
    active = true;

    try {
      return await operation();
    } finally {
      active = false;
    }
  };
}

export const withThemeCoverCleanupSlot = createThemeCoverCleanupSlot();
