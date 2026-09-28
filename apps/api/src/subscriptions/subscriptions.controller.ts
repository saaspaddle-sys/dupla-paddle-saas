import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { JWT_SECURITY_SCHEME, SWAGGER_TAGS } from '../swagger/swagger.setup';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import {
  ImmediateUpgradeCheckoutDto,
  ImmediateUpgradeQuoteDto,
} from './dto/immediate-upgrade.dto';
import {
  PlanDowngradeQuoteResponseDto,
  PlanDowngradeRequestDto,
} from './dto/plan-downgrade.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import {
  CreateUpgradeRequestDto,
  PlanUpgradeRequestDto,
} from './dto/plan-upgrade.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionUpgradeService } from './subscription-upgrade.service';

@ApiTags(SWAGGER_TAGS.clubs)
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, ClubScopeGuard)
@ApiBearerAuth(JWT_SECURITY_SCHEME)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly upgrades: SubscriptionUpgradeService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Returns the effective subscription for the current club',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'The account does not administer a club (`club_required`).',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
  ): Promise<SubscriptionResponseDto> {
    void clubId;
    return this.subscriptions.findMine(user.id);
  }

  @Get('me/upgrade-quote')
  @ApiOperation({
    summary: 'Quotes an immediate prorated Basic-to-Pro upgrade',
  })
  @ApiOkResponse({ type: ImmediateUpgradeQuoteDto })
  @ApiBadRequestResponse({
    description: 'Request validation failed (`validation`).',
  })
  @ApiConflictResponse({
    description:
      'An active paid Basic period with verified charge history is required.',
  })
  quoteUpgrade(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
    @Query() dto: PlanUpgradeRequestDto,
  ): Promise<ImmediateUpgradeQuoteDto> {
    void clubId;
    void dto;
    return this.upgrades.quote(user.id);
  }

  @Get('me/downgrade-quote')
  @ApiOperation({ summary: 'Quotes Pro-to-Basic for the next paid renewal' })
  @ApiOkResponse({ type: PlanDowngradeQuoteResponseDto })
  quoteDowngrade(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
    @Query() dto: PlanDowngradeRequestDto,
  ): Promise<PlanDowngradeQuoteResponseDto> {
    void clubId;
    void dto;
    return this.subscriptions.quoteDowngrade(user.id);
  }

  @Post('me/downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedules Pro-to-Basic after the paid Pro period' })
  @ApiOkResponse({ type: PlanDowngradeQuoteResponseDto })
  @ApiConflictResponse({
    description: 'The subscription cannot be downgraded now.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Mercado Pago could not confirm the recurring amount update.',
  })
  scheduleDowngrade(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
    @Body() dto: PlanDowngradeRequestDto,
  ): Promise<PlanDowngradeQuoteResponseDto> {
    void clubId;
    void dto;
    return this.subscriptions.scheduleDowngrade(user.id);
  }

  @Post('me/upgrade')
  @ApiOperation({
    summary: 'Starts a one-time prorated Basic-to-Pro payment',
  })
  @ApiCreatedResponse({ type: ImmediateUpgradeCheckoutDto })
  @ApiBadRequestResponse({
    description: 'Request validation failed (`validation`).',
  })
  @ApiConflictResponse({
    description:
      'The subscription is not eligible, another plan change is in progress, or the quoted amount changed (`upgrade_quote_changed`).',
  })
  @ApiServiceUnavailableResponse({
    description: 'The preference creation or recovery is unavailable.',
  })
  scheduleUpgrade(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
    @Body() dto: CreateUpgradeRequestDto,
  ): Promise<ImmediateUpgradeCheckoutDto> {
    void clubId;
    return this.upgrades.createCheckout(user.id, dto.expectedAmount);
  }

  @Post('me/checkouts')
  @ApiOperation({
    summary: 'Starts or reuses the monthly Mercado Pago recurring checkout',
  })
  @ApiCreatedResponse({ type: CheckoutResponseDto })
  @ApiBadRequestResponse({
    description: 'Request validation failed (`validation`).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'The account does not administer a club (`club_required`).',
  })
  @ApiConflictResponse({
    description:
      'An active Basic subscription must use `/subscriptions/me/upgrade` (`subscription_upgrade_required`); another active subscription cannot start a second checkout until its paid period ends. A checkout may also be pending or in progress.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Billing configuration or checkout recovery is unavailable (`billing_not_configured`, `billing_checkout_recovery_required`).',
  })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    void clubId;
    return this.subscriptions.createCheckout(user.id, dto.plan);
  }

  @Post('me/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resumes a paused Mercado Pago recurring subscription',
  })
  @ApiOkResponse({ description: 'Subscription renewal was resumed.' })
  @ApiConflictResponse({
    description:
      'The paused subscription period has ended (`paused_subscription_period_ended`).',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Mercado Pago is unavailable (`billing_provider_unavailable`).',
  })
  resumeMine(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
  ): Promise<void> {
    void clubId;
    return this.subscriptions.resumeMine(user.id);
  }

  @Post('me/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stops renewal while preserving the paid subscription period',
  })
  @ApiOkResponse({ description: 'Subscription renewal was paused.' })
  cancelMine(
    @CurrentUser() user: AuthenticatedUser,
    @ClubId() clubId: string,
  ): Promise<void> {
    void clubId;
    return this.subscriptions.cancelMine(user.id);
  }
}
