import { Storage } from '@google-cloud/storage';
import { logger } from '../logger';
import { env } from '../env';

const storageOptions = env.CLOUD_STORAGE.API_ENDPOINT_URL
  ? { apiEndpoint: env.CLOUD_STORAGE.API_ENDPOINT_URL } // for development using local emulator
  : {}; // for production
const storage = new Storage(storageOptions);

const EXPERIMENTAL_METADATA_LOG_PREFIX = 'Experimental Metadata';

enum DataKey {
  DOMAIN_PRICING = 'domainPricing',
}

// This class serve as a singleton for interacting with experimental data fetched from different sources
// Instance of the class should be created at server start
export class ExperimentMetadata {
  data: {
    [key in DataKey]?: any;
  } = {};

  public getDomainPricing(): any {
    return this.data[DataKey.DOMAIN_PRICING] || {};
  }

  public loadData = async (): Promise<void> => {
    const fileName =
      env.CLOUD_STORAGE.CLIENT_ASSETS.EXPERIMENTAL_DATA_FILE_NAME;
    const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
    const bucket = storage.bucket(bucketName);

    try {
      const [fileExists] = await bucket.file(fileName).exists();

      if (!fileExists) {
        logger.warn(
          `${EXPERIMENTAL_METADATA_LOG_PREFIX} - file cannot be found`,
        );
        return;
      }

      let buffer = '';

      const readStream = bucket.file(fileName).createReadStream();

      return new Promise((resolve) => {
        readStream
          .on('data', (data) => {
            logger.info(
              `${EXPERIMENTAL_METADATA_LOG_PREFIX} - reading data stream`,
            );
            buffer += data;
          })
          .on('error', (error) => {
            logger.error(
              `${EXPERIMENTAL_METADATA_LOG_PREFIX} - error streaming data from storage`,
              {
                error,
              },
            );
            resolve(undefined);
          })
          .on('end', () => {
            try {
              readStream.destroy();
              this.data = JSON.parse(buffer);
              logger.info(
                `${EXPERIMENTAL_METADATA_LOG_PREFIX} - end reading data stream`,
              );
            } catch (error) {
              logger.error(
                `${EXPERIMENTAL_METADATA_LOG_PREFIX} - error parsing json`,
                error,
              );
            }
            resolve(undefined);
          });
      });
    } catch (error) {
      logger.error(
        `${EXPERIMENTAL_METADATA_LOG_PREFIX} - error fetching data`,
        error,
      );
    }
  };
}

export const experimentMetadata = new ExperimentMetadata();
