import { GraphQLScalarType } from 'graphql';

export const ResolutionRecords = new GraphQLScalarType({
  name: 'ResolutionRecords',
  parseValue(value) {
    return JSON.parse(value);
  },
  serialize(value) {
    return value;
  },
});
