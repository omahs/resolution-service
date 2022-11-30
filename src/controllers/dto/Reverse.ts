import {
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  Matches,
  ArrayMaxSize,
} from 'class-validator';
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
  data: Array<DomainBaseResponse>;
}
