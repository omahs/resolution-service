import { ValueTransformer, FindOperator } from 'typeorm';

type FindOperatorValue<T> = FindOperator<T>['value'];

export const lowercaseTransformer: ValueTransformer = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: (entityValue: string | FindOperator<any>) => {
    if (entityValue instanceof FindOperator) {
      const { type, value, useParameter, multipleParameters } = entityValue;
      let operatorValue = value;

      if (type === 'in') {
        operatorValue = (value as FindOperatorValue<string[]>).map((value) =>
          value.toLowerCase(),
        );
      }

      return new FindOperator(
        type,
        operatorValue,
        useParameter,
        multipleParameters,
      );
    }

    return entityValue.toLowerCase();
  },
  from: (databaseValue: string) => {
    return databaseValue;
  },
};
