import type { TracerOptions } from 'dd-trace';
import tracer from 'dd-trace';
import { env } from './env';

console.log('env.Application=' + JSON.stringify(env.APPLICATION));
console.log('process.env.DD_AGENT_HOST=' + process.env.DD_AGENT_HOST);

if (env.APPLICATION.DATADOG_APM_ENABLE === 'true') {
  const options: TracerOptions = {
    //enabled: true,
    logLevel: 'debug',
    logInjection: true,
    profiling: true,
    reportHostname: true,
    runtimeMetrics: false, // requires UDP on port 8125
    startupLogs: true,
  };

  tracer.init(options);
}
