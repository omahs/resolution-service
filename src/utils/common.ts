export function convertToArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

export const PROFILE_FETCH_TIMEOUT_MS = 200;
