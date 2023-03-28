export function convertToArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

// adding a timeout to help mitigate against long-running external dependencies
export const PROFILE_FETCH_TIMEOUT_MS = 500;
