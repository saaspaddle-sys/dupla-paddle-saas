import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags(SWAGGER_TAGS.clubs)
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, ClubScopeGuard)
@ApiBearerAuth(JWT_SECURITY_SCHEME)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

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
      'A checkout is pending for another plan (`checkout_pending_for_another_plan`) or is being created (`checkout_in_progress`).',
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
}
