import { env } from '../env';
import request from 'request-promise';
import { HeapEvents, HeapEventsProperties } from '../types/heap';
import { logger } from '../logger';
import { HttpMethods } from '../types/common';

export const track = async (params: {
  identity: string;
  eventName: HeapEvents;
  properties?: HeapEventsProperties;
  // This is used to de-dupe events and should not be shorter than 8 characters.
  // Subsequent calls with same eventKey will not update data.
  eventKey?: string;
}) => {
  if (env.APPLICATION.HEAP.APP_ID) {
    try {
      const response = await request({
        method: HttpMethods.POST,
        uri: env.APPLICATION.HEAP.URI,
        body: {
          app_id: env.APPLICATION.HEAP.APP_ID,
          identity: params.identity,
          event: params.eventName,
          properties: params.properties,
          idempotency_key: params.eventKey,
        },
        json: true,
      });

      if (response !== 'OK') {
        throw new Error(`Heap Analytics API error (track): ${response}`);
      }
    } catch (error: any) {
      logger.error(error);
    }
  }
};

// @see https://help.heap.io/definitions/properties/properties-overview/#property-data-types
// https://help.heap.io/definitions/properties/how-to-create-defined-properties/
export const normalizeHeapPropParam = (
  property: string[] | number[],
  propertyName: string,
): string => {
  let result = `${property[0]}`;

  if (result.length > env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT) {
    logger.info(
      `Heap property (${propertyName}) has reached the max character length: ${property}`,
    );
    return '...,';
  }

  // Add data to string only if data does not pass character limit constraint.
  if (property.length > 1) {
    const remainingProperties = property.slice(1);
    for (const prop of remainingProperties) {
      if (
        `${result},${prop}`.length <=
        env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT
      ) {
        result = `${result},${prop}`;
      }

      if (
        `${result},${prop}`.length >
        env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT
      ) {
        // Add ',...' to indicate that the property has been truncated.
        if (
          `${result},...`.length <=
          env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT
        ) {
          result = `${result},...`;
        } else {
          // determine where the result length with ',...' is not > max
          const index = determineIndex(result.split(','));
          if (index === -1) {
            logger.info(
              `Heap property (${propertyName}) has reached the max character length: ${property}`,
            );
            result = '...,';
            break;
          }

          result = `${result.split(',').slice(0, index).join(',')},...`;
        }

        logger.info(
          `Heap property (${propertyName}) has reached the max character length: ${property}`,
        );
        break;
      }
    }
  }

  return result;
};

const determineIndex = (array: string[] | number[]): number => {
  let result = 0;

  if (
    `${array[0]},...`.length > env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT
  ) {
    return -1;
  }

  for (let i = 1; i < array.length - 1; i++) {
    if (
      `${array.slice(0, i).join(',')},...`.length >
      env.APPLICATION.HEAP.PROP_MAX_CHARACTER_LIMIT
    ) {
      result = i - 1;
      break;
    }
  }

  return result;
};
