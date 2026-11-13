/**
 * Minimal `next/headers` stand-in for the Node verification harness.
 * `uploadExport` only touches the service-role client; the cookie store is never read.
 */
export async function cookies() {
  return {
    getAll: () => [],
    get: () => undefined,
    set: () => {},
    delete: () => {},
    has: () => false,
  };
}

export async function headers() {
  return new Headers();
}
