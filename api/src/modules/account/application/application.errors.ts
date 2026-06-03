import { ConflictException, NotFoundException } from '@nestjs/common';

export const AccountUserNotFound = () =>
  new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });

export const PlanNotAvailable = () =>
  new ConflictException({ code: 'PLAN_NOT_AVAILABLE', message: 'Plan not found or inactive.' });
