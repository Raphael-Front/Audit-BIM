import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { CreatePhaseDto } from "./dto/create-phase.dto";
import { CreateWorkDto } from "./dto/create-work.dto";
import { UpdatePhaseDto } from "./dto/update-phase.dto";
import { UpdateWorkDto } from "./dto/update-work.dto";
import { WorksService } from "./works.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get("works")
  async listWorks() {
    return this.works.listWorks();
  }

  @Get("works/:workId/phases")
  async listPhases(@Param("workId") workId: string) {
    return this.works.listPhases(workId);
  }

  @Get("works/:id")
  async getWork(@Param("id") id: string) {
    return this.works.getWork(id);
  }

  @Post("works")
  @Roles(UserRole.ADMIN)
  async createWork(@Body() dto: CreateWorkDto) {
    return this.works.createWork(dto);
  }

  @Patch("works/:id")
  @Roles(UserRole.ADMIN)
  async updateWork(@Param("id") id: string, @Body() dto: UpdateWorkDto) {
    return this.works.updateWork(id, dto);
  }

  @Post("works/:workId/phases")
  @Roles(UserRole.ADMIN)
  async createPhase(@Param("workId") workId: string, @Body() dto: CreatePhaseDto) {
    return this.works.createPhase(workId, dto);
  }

  @Patch("phases/:id")
  @Roles(UserRole.ADMIN)
  async updatePhase(@Param("id") id: string, @Body() dto: UpdatePhaseDto) {
    return this.works.updatePhase(id, dto);
  }
}

