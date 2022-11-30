import {
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  Matches,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ETHAddressRegex } from '../../utils/ethersUtils';
import { DomainBaseResponse } from './Domains';

export class BulkReverseQueryParams {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @Matches(ETHAddressRegex, { each: true })
  addresses: string[];
}

export class BulkReverseQueryResponse {
  @ValidateNested()
  @JSONSchema({
    items: {
      $ref: '#/components/schemas/DomainBaseResponse',
    },
    type: 'array',
    $ref: '',
  })
  data: DomainBaseResponse[];
}
