import { GraphQLSchema } from 'graphql';
import { buildSchema } from 'type-graphql';
import { DomainResolver } from './resolvers/DomainResolver';

export const buildGraphQLSchema = async (): Promise<GraphQLSchema> => {
  return buildSchema({
    resolvers: [DomainResolver],
  });
};
