import type { TracerOptions } from 'dd-trace';
import tracer from 'dd-trace';
import { env } from './env';

if (env.APPLICATION.DATADOG_APM_ENABLE) {
  const options: TracerOptions = {
    //enabled: true,
    logLevel: 'debug',
    logInjection: true,
    profiling: true,
    reportHostname: true,
    runtimeMetrics: false, // requires UDP on port 8125
    startupLogs: true,
    plugins: true,
  };

  tracer.init(options);
  // force-enable express because it is note enabled automagically for some reason
  tracer.use('express', {
    enabled: true,
  });
}
