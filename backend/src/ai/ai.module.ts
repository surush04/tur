import { Module } from '@nestjs/common';
import { PlannerController } from './planner.controller';

@Module({ controllers: [PlannerController] })
export class AiModule {}
