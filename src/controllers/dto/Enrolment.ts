import { IsNotEmpty, IsString } from 'class-validator';

export class APIKeyEnrolmentParams {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
