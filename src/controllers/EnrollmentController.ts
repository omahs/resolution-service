import {
  Body,
  JsonController,
  Post,
  HeaderParam,
  ForbiddenError,
  BadRequestError,
} from 'routing-controllers';
import 'reflect-metadata';
import { ApiKey } from '../models';
import { getConnection } from 'typeorm';
import { APIKeyEnrollmentParams } from './dto/Enrollment';
import { env } from '../env';

@JsonController()
export class EnrollmentController {
  @Post('/enroll')
  async postEnroll(
    @Body() params: APIKeyEnrollmentParams,
    @HeaderParam('app-auth-token') token: string,
  ): Promise<number> {
    const secretResellerAppToken = env.APPLICATION.APP_AUTH_KEY;

    if (!secretResellerAppToken || token !== secretResellerAppToken) {
      throw new ForbiddenError('Please provide a valid app token.');
    }

    const existingKey = await ApiKey.queryApiKey(params.key);
    if (existingKey) {
      throw new BadRequestError('Key exists.');
    }

    await getConnection().transaction(async (manager) => {
      const newKey = new ApiKey();
      newKey.attributes({
        name: params.name,
        apiKey: params.key,
      });
      await manager.save(newKey);
    });
    return 200;
  }
}
