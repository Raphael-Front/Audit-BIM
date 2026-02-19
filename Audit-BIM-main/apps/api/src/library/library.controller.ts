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
import { PerfilUsuario } from '@bim-audit/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateAuditPhaseDto } from './dto/create-audit-phase.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateAuditPhaseDto } from './dto/update-audit-phase.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('audit-phases')
  listAuditPhases(@Query('active') active?: string) {
    return this.library.listAuditPhases(
      active === undefined ? undefined : active === 'true',
    );
  }

  @Post('audit-phases')
  @Roles(PerfilUsuario.admin_bim)
  createAuditPhase(@Body() dto: CreateAuditPhaseDto) {
    return this.library.createAuditPhase(dto);
  }

  @Patch('audit-phases/:id')
  @Roles(PerfilUsuario.admin_bim)
  updateAuditPhase(
    @Param('id') id: string,
    @Body() dto: UpdateAuditPhaseDto,
  ) {
    return this.library.updateAuditPhase(id, dto);
  }

  @Get('disciplines')
  listDisciplines() {
    return this.library.listDisciplines();
  }

  @Post('disciplines')
  @Roles(PerfilUsuario.admin_bim)
  createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.library.createDiscipline(dto);
  }

  @Patch('disciplines/:id')
  @Roles(PerfilUsuario.admin_bim)
  updateDiscipline(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineDto,
  ) {
    return this.library.updateDiscipline(id, dto);
  }

  @Get('categories')
  listCategories(@Query('disciplineId') disciplineId?: string) {
    return this.library.listCategories(disciplineId);
  }

  @Post('categories')
  @Roles(PerfilUsuario.admin_bim)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.library.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles(PerfilUsuario.admin_bim)
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.library.updateCategory(id, dto);
  }

  @Post('categories/:id/disciplines')
  @Roles(PerfilUsuario.admin_bim)
  linkCategoryToDiscipline(
    @Param('id') id: string,
    @Body() body: { disciplineId: string; order?: number },
  ) {
    return this.library.linkCategoryToDiscipline(
      id,
      body.disciplineId,
      body.order,
    );
  }

  @Get('checklist-items')
  listChecklistItems(
    @Query('categoryId') categoryId?: string,
    @Query('auditPhaseId') auditPhaseId?: string,
    @Query('active') active?: string,
  ) {
    return this.library.listChecklistItems({
      categoryId,
      auditPhaseId,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Post('checklist-items')
  @Roles(PerfilUsuario.admin_bim)
  createChecklistItem(@Body() dto: CreateChecklistItemDto) {
    return this.library.createChecklistItem(dto);
  }

  @Patch('checklist-items/:id')
  @Roles(PerfilUsuario.admin_bim)
  updateChecklistItem(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.library.updateChecklistItem(id, dto);
  }
}
