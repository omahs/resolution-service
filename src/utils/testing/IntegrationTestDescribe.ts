import { env } from '../../env';

export function describeIntegrationTest(
  title: string,
  fn: (this: Mocha.Suite) => void,
): Mocha.Suite | void {
  const integrationTitle = `[Integration] - ${title}`;
  if (env.TEST.INTEGRATION) {
    return describe(integrationTitle, fn);
  } else {
    return describe.skip(integrationTitle, fn);
  }
}
