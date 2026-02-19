import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  controllers: [WorksController],
  providers: [WorksService, RolesGuard],
})
export class WorksModule {}
