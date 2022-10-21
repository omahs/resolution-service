import { IsNotEmpty, IsString } from 'class-validator';

export class APIKeyEnrollmentParams {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
