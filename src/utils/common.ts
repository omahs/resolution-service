import atob from 'atob';
import btoa from 'btoa';

export function convertToArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

export function base64DecodeURL(base64urlstring: string) {
  return new Uint8Array(
    atob(base64urlstring.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((val) => {
        return val.charCodeAt(0);
      }),
  );
}

export function base64EncodeURL() {
  return btoa(
    Array.from(new Uint8Array())
      .map((val) => {
        return String.fromCharCode(val);
      })
      .join(''),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// adding a timeout to help mitigate against long-running external dependencies
export const PROFILE_FETCH_TIMEOUT_MS = 200;
