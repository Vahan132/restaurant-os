import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReservationsModule } from '../reservations/reservations.module';
import { ConsumerIdentityModule } from '../consumer-identity/consumer-identity.module';
import { ConsumerAuthGuard } from '../consumer-identity/presentation/http/consumer-auth.guard';
import { IdentityModule } from '../identity/identity.module';

import { ATTRIBUTE_TAXONOMY_REPOSITORY } from './domain/repositories/attribute-taxonomy.repository';
import { RESTAURANT_MARKETING_REPOSITORY } from './domain/repositories/restaurant-marketing.repository';
import { BRANCH_PUBLIC_REPOSITORY } from './domain/repositories/branch-public.repository';
import { SAVED_RESTAURANT_REPOSITORY } from './domain/repositories/saved-restaurant.repository';
import { CONSUMER_RESERVATION_REPOSITORY } from './domain/repositories/consumer-reservation.repository';
import { CONSUMER_PROFILE_READER } from './domain/repositories/consumer-profile.reader';

import { PrismaAttributeTaxonomyRepository } from './infrastructure/persistence/prisma-attribute-taxonomy.repository';
import { PrismaRestaurantMarketingRepository } from './infrastructure/persistence/prisma-restaurant-marketing.repository';
import { PrismaBranchPublicRepository } from './infrastructure/persistence/prisma-branch-public.repository';
import { PrismaSavedRestaurantRepository } from './infrastructure/persistence/prisma-saved-restaurant.repository';
import { PrismaConsumerReservationRepository } from './infrastructure/persistence/prisma-consumer-reservation.repository';
import { PrismaConsumerProfileReader } from './infrastructure/persistence/prisma-consumer-profile.reader';

import { GetAttributeTaxonomyUseCase } from './application/queries/get-attribute-taxonomy.usecase';
import { ListConsumerBranchesUseCase } from './application/queries/list-consumer-branches.usecase';
import { GetConsumerBranchDetailUseCase } from './application/queries/get-consumer-branch-detail.usecase';
import { GetConsumerBranchAvailabilityUseCase } from './application/queries/get-consumer-branch-availability.usecase';

import { UpdateRestaurantMarketingProfileUseCase } from './application/commands/update-restaurant-marketing-profile.usecase';
import { SetRestaurantAttributesUseCase } from './application/commands/set-restaurant-attributes.usecase';
import { AddRestaurantPhotoUseCase } from './application/commands/add-restaurant-photo.usecase';
import { ReorderRestaurantPhotosUseCase } from './application/commands/reorder-restaurant-photos.usecase';
import { RemoveRestaurantPhotoUseCase } from './application/commands/remove-restaurant-photo.usecase';
import { SetBranchPublicContactUseCase } from './application/commands/set-branch-public-contact.usecase';
import { SetBranchPublicHoursUseCase } from './application/commands/set-branch-public-hours.usecase';
import {
  SetBranchMenuPublicUseCase,
  SetBranchReservationsPublicUseCase,
} from './application/commands/set-branch-visibility.usecase';
import { SetBranchListedUseCase } from './application/commands/set-branch-listed.usecase';

// CX-ADMIN owner read-back + platform-scoped write use-cases.
import { GetOwnerRestaurantListingUseCase } from './application/queries/get-owner-restaurant-listing.usecase';
import { GetOwnerBranchListingUseCase } from './application/queries/get-owner-branch-listing.usecase';
import { GetFullAttributeTaxonomyUseCase } from './application/queries/get-full-attribute-taxonomy.usecase';
import { SetConsumerListingSuppressedUseCase } from './application/commands/set-consumer-listing-suppressed.usecase';
import {
  CreateAttributeCategoryUseCase,
  CreateAttributeValueUseCase,
  DeleteAttributeCategoryUseCase,
  DeleteAttributeValueUseCase,
  UpdateAttributeCategoryUseCase,
  UpdateAttributeValueUseCase,
} from './application/commands/manage-attribute-taxonomy.usecase';
import { AdminConsumerListingController } from './presentation/http/admin-consumer-listing.controller';

import { GetConsumerBookableSlotsUseCase } from './application/queries/get-consumer-bookable-slots.usecase';
import { CreateConsumerReservationUseCase } from './application/commands/create-consumer-reservation.usecase';
import { ListMyReservationsUseCase } from './application/queries/list-my-reservations.usecase';
import { CancelMyReservationUseCase } from './application/commands/cancel-my-reservation.usecase';
import { SaveRestaurantUseCase } from './application/commands/save-restaurant.usecase';
import { UnsaveRestaurantUseCase } from './application/commands/unsave-restaurant.usecase';
import { ListSavedRestaurantsUseCase } from './application/queries/list-saved-restaurants.usecase';

import { PublicDiscoveryController } from './presentation/http/public-discovery.controller';
import { ConsumerBookingController } from './presentation/http/consumer-booking.controller';
import { ConsumerSavedController } from './presentation/http/consumer-saved.controller';

/**
 * Consumer discovery module (CX-1). PUBLIC, anonymous, cross-restaurant read API
 * + the write use-cases (exercised by the seed now, by CX-ADMIN later). Imports
 * ReservationsModule to REUSE GetTableAvailabilityUseCase for the availability
 * endpoint. Routes are rate-limited per IP. No tenant resolver (the discovery
 * surface is a marketplace, addressed by globally-unique branchId).
 */
@Module({
  imports: [
    ReservationsModule,
    ConsumerIdentityModule,
    IdentityModule, // CX-ADMIN: BRANCH_ACCESS_RESOLVER for owner branch-route validation.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [
    PublicDiscoveryController,
    ConsumerBookingController,
    ConsumerSavedController,
    AdminConsumerListingController,
  ],
  providers: [
    // read use-cases (anonymous)
    GetAttributeTaxonomyUseCase,
    ListConsumerBranchesUseCase,
    GetConsumerBranchDetailUseCase,
    GetConsumerBranchAvailabilityUseCase,
    // CX-3 booking + saved use-cases
    ConsumerAuthGuard, // instantiated here from ConsumerIdentityModule's exported token service
    GetConsumerBookableSlotsUseCase,
    CreateConsumerReservationUseCase,
    ListMyReservationsUseCase,
    CancelMyReservationUseCase,
    SaveRestaurantUseCase,
    UnsaveRestaurantUseCase,
    ListSavedRestaurantsUseCase,
    // write use-cases (seed + CX-ADMIN)
    UpdateRestaurantMarketingProfileUseCase,
    SetRestaurantAttributesUseCase,
    AddRestaurantPhotoUseCase,
    ReorderRestaurantPhotosUseCase,
    RemoveRestaurantPhotoUseCase,
    SetBranchPublicContactUseCase,
    SetBranchPublicHoursUseCase,
    SetBranchMenuPublicUseCase,
    SetBranchReservationsPublicUseCase,
    SetBranchListedUseCase,
    // CX-ADMIN owner read-back + platform-scoped taxonomy/kill-switch use-cases
    GetOwnerRestaurantListingUseCase,
    GetOwnerBranchListingUseCase,
    GetFullAttributeTaxonomyUseCase,
    SetConsumerListingSuppressedUseCase,
    CreateAttributeCategoryUseCase,
    UpdateAttributeCategoryUseCase,
    DeleteAttributeCategoryUseCase,
    CreateAttributeValueUseCase,
    UpdateAttributeValueUseCase,
    DeleteAttributeValueUseCase,
    // port → Prisma implementation bindings
    { provide: ATTRIBUTE_TAXONOMY_REPOSITORY, useClass: PrismaAttributeTaxonomyRepository },
    { provide: RESTAURANT_MARKETING_REPOSITORY, useClass: PrismaRestaurantMarketingRepository },
    { provide: BRANCH_PUBLIC_REPOSITORY, useClass: PrismaBranchPublicRepository },
    { provide: SAVED_RESTAURANT_REPOSITORY, useClass: PrismaSavedRestaurantRepository },
    { provide: CONSUMER_RESERVATION_REPOSITORY, useClass: PrismaConsumerReservationRepository },
    { provide: CONSUMER_PROFILE_READER, useClass: PrismaConsumerProfileReader },
  ],
  exports: [
    UpdateRestaurantMarketingProfileUseCase,
    SetRestaurantAttributesUseCase,
    AddRestaurantPhotoUseCase,
    ReorderRestaurantPhotosUseCase,
    RemoveRestaurantPhotoUseCase,
    SetBranchPublicContactUseCase,
    SetBranchPublicHoursUseCase,
    SetBranchMenuPublicUseCase,
    SetBranchReservationsPublicUseCase,
    SetBranchListedUseCase,
    // Exported for the platform-admin controller (PlatformModule imports ConsumerModule).
    SetConsumerListingSuppressedUseCase,
    GetFullAttributeTaxonomyUseCase,
    CreateAttributeCategoryUseCase,
    UpdateAttributeCategoryUseCase,
    DeleteAttributeCategoryUseCase,
    CreateAttributeValueUseCase,
    UpdateAttributeValueUseCase,
    DeleteAttributeValueUseCase,
  ],
})
export class ConsumerModule {}
