import { Module } from '@nestjs/common';
import { ExpensesService } from './application/expenses.service';
import {
  ExpenseCategoriesController,
  ExpensesController,
} from './presentation/http/expenses.controller';

/**
 * EXPENSES-1 — non-stock operating expenses (furniture, stationery, repairs…)
 * managed by the admin next to inventory write-offs. They never move stock; the
 * reports module reads them for the period profit export.
 */
@Module({
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
