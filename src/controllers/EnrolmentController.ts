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
import { APIKeyEnrolmentParams } from './dto/Enrolment';

@JsonController()
export class EnrolmentController {
  @Post('/enrol')
  async postEnrol(
    @Body() params: APIKeyEnrolmentParams,
    @HeaderParam('reseller-app-token') token: string,
  ): Promise<void> {
    const secretResellerAppToken = getConfig().RESELLER_APP_TOKEN;

    if (token !== secretResellerAppToken) {
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
  }
}
