import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { API_TAGS } from './swagger/swagger.setup';

// Scaffold: se va junto con `app.service.ts` cuando lleguen los módulos reales
// (ver AGENTS.md). Queda documentado para que `/docs` no arranque vacío.
@ApiTags(API_TAGS.public)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Ping del scaffold de NestJS' })
  @ApiOkResponse({ schema: { type: 'string', example: 'Hello World!' } })
  getHello(): string {
    return this.appService.getHello();
  }
}
