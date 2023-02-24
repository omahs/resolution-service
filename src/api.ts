import 'reflect-metadata';
import {
  createExpressServer,
  getMetadataArgsStorage,
} from 'routing-controllers';
import { DomainsController } from './controllers/DomainsController';
import { ReverseController } from './controllers/ReverseController';
import { StatusController } from './controllers/StatusController';
import { MetaDataController } from './controllers/MetaDataController';
import { EnrollmentController } from './controllers/EnrollmentController';
import { RpcProxyController } from './controllers/RpcProxyController';
import swaggerUI from 'swagger-ui-express';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginExpress from '@bugsnag/plugin-express';
import { env } from './env';
import ErrorHandler from './errors/ErrorHandler';
import { RoutingControllersOptions } from 'routing-controllers';
import * as oa from 'openapi3-ts';
import { Request, Response } from 'express';
import InMemoryCache from './database/TypeormInMemoryCache';

const enabledControllers = [];

if (
  env.APPLICATION.RUNNING_MODE.includes('API') ||
  env.APPLICATION.RUNNING_MODE.includes('SERVICE_API')
) {
  enabledControllers.push(DomainsController);
  enabledControllers.push(ReverseController);
  enabledControllers.push(StatusController);
  enabledControllers.push(EnrollmentController);
  enabledControllers.push(RpcProxyController);
}

if (
  env.APPLICATION.RUNNING_MODE.includes('API') ||
  env.APPLICATION.RUNNING_MODE.includes('METADATA_API')
) {
  if (!(env.MORALIS.API_URL && env.MORALIS.APP_ID && env.OPENSEA.API_KEY)) {
    throw new Error(
      `Environment variables are not defined for METADATA_API: MORALIS_API_URL, MORALIS_APP_ID, OPENSEA_API_KEY`,
    );
  }
  enabledControllers.push(MetaDataController);
}

export const api = createExpressServer({
  classTransformer: true,
  defaultErrorHandler: false,
  cors: true,
  controllers: enabledControllers,
  middlewares: [ErrorHandler],
});

api.set('trust proxy', true);

if (env.APPLICATION.BUGSNAG_API_KEY) {
  Bugsnag.start({
    apiKey: env.APPLICATION.BUGSNAG_API_KEY,
    plugins: [BugsnagPluginExpress],
  });
  const bugsnagPlugin = Bugsnag.getPlugin('express');
  api.use(bugsnagPlugin?.requestHandler);
  api.use(bugsnagPlugin?.errorHandler);
}

const schemas = validationMetadatasToSchemas({
  refPointerPrefix: '#/components/schemas/',
});

const description =
  'The Resolution Service provides an API for getting domain data and metadata regardless \
of the blockchain in which the domain is stored. The service caches blockchain events in a database for easy \
retrieval without accessing any blockchain APIs. With the Resolution Service API, you can quickly build \
applications directly communicating with the blockchain to get UD domain data with a single API request.';

const storage = getMetadataArgsStorage();
const routingControllerOptions: RoutingControllersOptions = {};
const additionalProperties: Partial<oa.OpenAPIObject> = {
  info: {
    title: 'Resolution Service',
    description: description,
    version: '1.0.0',
  },
  components: {
    schemas,
    securitySchemes: {
      apiKeyAuth: {
        scheme: 'bearer',
        type: 'http',
      },
    },
  },
};

const swaggerSpec = routingControllersToSpec(
  storage,
  routingControllerOptions,
  additionalProperties,
);

// There's no way to set a custom attribute for a specific parameter in routing-controllers-openapi
// We could add a custom decorator for attributes in the future if we need to set more attributes
// But it's easier to just hard-code it for now
swaggerSpec.paths['/domains'].get.parameters[0].style = 'deepObject';

const options = {
  swaggerOptions: {
    url: '/api-docs/swagger.json',
  },
};

api.get('/_status', (_: Request, res: Response) => {
  res.json({
    typeOrmCacheStats: InMemoryCache.getStatistics(),
  });
});

api.get('/api-docs/swagger.json', (_req: Request, res: Response) =>
  res.json(swaggerSpec),
);
api.use(
  '/api-docs',
  swaggerUI.serveFiles(undefined, options),
  swaggerUI.setup(undefined, options),
);
