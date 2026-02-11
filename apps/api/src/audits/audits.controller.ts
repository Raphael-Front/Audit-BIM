import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StatusAuditoria } from '@bim-audit/db';
import type { AuthUser } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AddCustomItemDto } from './dto/add-custom-item.dto';
import { CancelAuditDto } from './dto/cancel-audit.dto';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditItemDto } from './dto/update-audit-item.dto';
import { AuditsService } from './audits.service';

@Controller('audits')
@UseGuards(JwtAuthGuard)
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  @Get()
  async list(
    @Query('workId') workId?: string,
    @Query('phaseId') phaseId?: string,
    @Query('status') status?: StatusAuditoria,
    @Query('auditorId') auditorId?: string,
  ) {
    return this.audits.list({
      workId: workId ?? undefined,
      phaseId: phaseId ?? undefined,
      status: status ?? undefined,
      auditorId: auditorId ?? undefined,
    });
  }

  @Post()
  async create(@Body() dto: CreateAuditDto, @CurrentUser() user?: AuthUser) {
    return this.audits.create(dto, user!.id);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.audits.getById(id);
  }

  @Post(':id/finish-verification')
  async finishVerification(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.audits.finishVerification(id, user!.id);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.audits.completeAudit(id, user!.id);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAuditDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.audits.cancelAudit(id, user!.id, dto.reason);
  }

  @Post(':id/custom-items')
  async addCustomItem(
    @Param('id') id: string,
    @Body() dto: AddCustomItemDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.audits.addCustomItem(id, dto, user!.id);
  }

  @Get(':id/items')
  async items(@Param('id') id: string) {
    return this.audits.getItems(id);
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAuditItemDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.audits.updateItem(id, itemId, dto, user!.id);
  }

  @Get(':id/scores')
  async scores(@Param('id') id: string) {
    return this.audits.getScores(id);
  }
}
