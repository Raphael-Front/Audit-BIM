import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, RolesGuard],
  exports: [LibraryService],
})
export class LibraryModule {}
