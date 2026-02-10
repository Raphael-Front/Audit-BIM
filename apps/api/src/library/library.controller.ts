import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { CreateAuditPhaseDto } from "./dto/create-audit-phase.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateChecklistItemDto } from "./dto/create-checklist-item.dto";
import { CreateDisciplineDto } from "./dto/create-discipline.dto";
import { UpdateAuditPhaseDto } from "./dto/update-audit-phase.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateChecklistItemDto } from "./dto/update-checklist-item.dto";
import { UpdateDisciplineDto } from "./dto/update-discipline.dto";
import { LibraryService } from "./library.service";

@Controller("library")
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get("audit-phases")
  listAuditPhases(@Query("active") active?: string) {
    return this.library.listAuditPhases(active === undefined ? undefined : active === "true");
  }

  @Post("audit-phases")
  @Roles(UserRole.ADMIN)
  createAuditPhase(@Body() dto: CreateAuditPhaseDto) {
    return this.library.createAuditPhase(dto);
  }

  @Patch("audit-phases/:id")
  @Roles(UserRole.ADMIN)
  updateAuditPhase(@Param("id") id: string, @Body() dto: UpdateAuditPhaseDto) {
    return this.library.updateAuditPhase(id, dto);
  }

  @Get("disciplines")
  listDisciplines() {
    return this.library.listDisciplines();
  }

  @Post("disciplines")
  @Roles(UserRole.ADMIN)
  createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.library.createDiscipline(dto);
  }

  @Patch("disciplines/:id")
  @Roles(UserRole.ADMIN)
  updateDiscipline(@Param("id") id: string, @Body() dto: UpdateDisciplineDto) {
    return this.library.updateDiscipline(id, dto);
  }

  @Get("categories")
  listCategories(@Query("disciplineId") disciplineId?: string) {
    return this.library.listCategories(disciplineId);
  }

  @Post("categories")
  @Roles(UserRole.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.library.createCategory(dto);
  }

  @Patch("categories/:id")
  @Roles(UserRole.ADMIN)
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.library.updateCategory(id, dto);
  }

  @Get("checklist-items")
  listChecklistItems(
    @Query("categoryId") categoryId?: string,
    @Query("auditPhaseId") auditPhaseId?: string,
    @Query("active") active?: string,
  ) {
    return this.library.listChecklistItems({
      categoryId,
      auditPhaseId,
      active: active === undefined ? undefined : active === "true",
    });
  }

  @Post("checklist-items")
  @Roles(UserRole.ADMIN)
  createChecklistItem(@Body() dto: CreateChecklistItemDto) {
    return this.library.createChecklistItem(dto);
  }

  @Patch("checklist-items/:id")
  @Roles(UserRole.ADMIN)
  updateChecklistItem(@Param("id") id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.library.updateChecklistItem(id, dto);
  }
}

