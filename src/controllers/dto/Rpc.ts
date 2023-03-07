import {
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';

export class RpcResponse {
  @IsString()
  jsonrpc: string;

  @IsNumber()
  id: number;

  @IsString()
  @IsOptional()
  data: string;

  @ValidateNested()
  error: any;
}
