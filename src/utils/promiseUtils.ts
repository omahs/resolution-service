export const withPromiseTimeout = <T>(
  mainPromise: Promise<T>,
  timeLimit: number,
): Promise<T> => {
  if (timeLimit <= 0) {
    throw new Error('Invalid timeout argument');
  }

  const timeout = new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject('Promise is rejected for timeout');
    }, timeLimit);
  }) as Promise<T>;

  return Promise.race([mainPromise, timeout]);
};
