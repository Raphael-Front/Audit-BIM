import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PerfilUsuario } from '@bim-audit/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorksService } from './works.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get('works')
  async listWorks() {
    return this.works.listWorks();
  }

  @Get('works/:workId/phases')
  async listPhases(@Param('workId') workId: string) {
    return this.works.listPhases(workId);
  }

  @Get('works/:id')
  async getWork(@Param('id') id: string) {
    return this.works.getWork(id);
  }

  @Post('works')
  @Roles(PerfilUsuario.admin_bim, PerfilUsuario.auditor_bim)
  async createWork(@Body() dto: CreateWorkDto) {
    return this.works.createWork(dto);
  }

  @Patch('works/:id')
  @Roles(PerfilUsuario.admin_bim, PerfilUsuario.auditor_bim)
  async updateWork(@Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.works.updateWork(id, dto);
  }

  @Post('works/:workId/phases')
  @Roles(PerfilUsuario.admin_bim, PerfilUsuario.auditor_bim)
  async createPhase(
    @Param('workId') workId: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.works.createPhase(workId, dto);
  }

  @Patch('phases/:id')
  @Roles(PerfilUsuario.admin_bim, PerfilUsuario.auditor_bim)
  async updatePhase(@Param('id') id: string, @Body() dto: UpdatePhaseDto) {
    return this.works.updatePhase(id, dto);
  }
}
