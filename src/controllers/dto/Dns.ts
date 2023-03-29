import { IsString } from 'class-validator';

export class DnsQuery {
  @IsString()
  dns: string;
}
