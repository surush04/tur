import { Body, Controller, Get, Headers, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { decToString } from '../common/money';
import { PLAN_DISCLAIMER, PlannerPlace, buildDemoItinerary } from '../common/planner-rules';
import { localize, requestLang } from '../common/lang';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

class PlanDto {
  @IsString() @MinLength(2) @MaxLength(120) startLocation!: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) travelers!: number;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) budgetTjs!: string;
  @IsArray() @IsString({ each: true }) interests!: string[];
  @IsOptional() @IsString() @MaxLength(80) travelStyle?: string;
  @IsOptional() @IsString() @MaxLength(80) transport?: string;
  @IsOptional() @IsString() @MaxLength(80) accommodation?: string;
  @IsOptional() @IsString() @MaxLength(240) accessibility?: string;
  @IsOptional() @IsBoolean() demo?: boolean;
}

@ApiTags('ai')
@Controller('ai')
export class PlannerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('status')
  status() {
    return {
      data: {
        configured: Boolean(this.config.get<string>('AI_API_KEY')),
        mode: this.config.get<string>('AI_API_KEY') ? 'provider' : 'not_configured',
      },
    };
  }

  @Public()
  @ApiBearerAuth()
  @Throttle({ default: { limit: 12, ttl: 3600000 } })
  @Post('plan')
  async plan(@Body() dto: PlanDto, @Headers('accept-language') lang?: string) {
    const places = await this.places(requestLang(lang));
    if (dto.demo) {
      return { data: { source: 'DEMO', ...buildDemoItinerary(this.input(dto), places) } };
    }
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        message: 'The AI provider is not configured. Add AI_API_KEY on the server, or switch on demo mode.',
        code: 'AI_NOT_CONFIGURED',
      });
    }
    const plan = await this.livePlan(dto, places, apiKey);
    return { data: { source: 'AI', ...plan } };
  }

  private input(dto: PlanDto) {
    return {
      startLocation: dto.startLocation.trim(),
      region: dto.region,
      startDate: dto.startDate,
      endDate: dto.endDate,
      travelers: dto.travelers,
      budgetTjs: dto.budgetTjs,
      interests: dto.interests,
      travelStyle: dto.travelStyle,
      transport: dto.transport,
      accommodation: dto.accommodation,
      accessibility: dto.accessibility,
    };
  }

  private async places(lang: 'en' | 'ru' | 'tg'): Promise<PlannerPlace[]> {
    const rows = await this.prisma.destination.findMany({
      where: { published: true },
      include: { tours: { where: { published: true }, take: 1, orderBy: { pricePerPerson: 'asc' } } },
    });
    return rows.map((row) => {
      const tour = row.tours[0];
      return {
        id: row.id,
        name: row.name,
        region: row.region,
        category: row.category,
        summary: localize(row.copy, lang).summary,
        suggestedDays: row.suggestedDays ?? 1,
        budgetMin: decToString(row.budgetEstimateMin),
        activities: row.activities,
        tourId: tour?.id ?? null,
        tourSlug: tour?.slug ?? null,
        tourTitle: tour ? (localize(tour.copy, lang).title ?? tour.title) : null,
        tourPrice: tour ? decToString(tour.pricePerPerson) : null,
      };
    });
  }

  private async livePlan(dto: PlanDto, places: PlannerPlace[], apiKey: string) {
    const base = (this.config.get<string>('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini';
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You plan trips in Tajikistan using only the supplied catalog. Do not invent live road status, exact driving times, current prices, or confirmed availability. Money is TJS. If the budget is too small, set budgetShortfall true and explain a smaller alternative. Reply with JSON: {title, days:[{dayNumber,title,notes,activities:[{title,placeName,description,timeEstimateNote,transportNote,estimatedCost,tourId,sortOrder}]}], totalEstimate, alternatives, budgetShortfall, packing:[], assumptions:[]}. estimatedCost is a decimal string or null. tourId must be null or one of the catalog tour ids.',
          },
          { role: 'user', content: JSON.stringify({ request: this.input(dto), catalog: places }) },
        ],
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException({
        message: 'The AI provider did not return a plan. You can try again or use demo mode.',
        code: 'AI_PROVIDER',
      });
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new ServiceUnavailableException({
        message: 'The AI provider returned an empty plan.',
        code: 'AI_PROVIDER',
      });
    }
    let parsed: { days?: unknown; title?: string };
    try {
      parsed = JSON.parse(text) as { days?: unknown; title?: string };
    } catch {
      throw new ServiceUnavailableException({
        message: 'The AI provider returned a plan that could not be read.',
        code: 'AI_PROVIDER',
      });
    }
    if (!parsed.title || !Array.isArray(parsed.days)) {
      throw new ServiceUnavailableException({
        message: 'The AI provider returned an incomplete plan.',
        code: 'AI_PROVIDER',
      });
    }
    return { ...parsed, disclaimer: PLAN_DISCLAIMER };
  }
}
