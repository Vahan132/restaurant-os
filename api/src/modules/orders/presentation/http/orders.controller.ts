import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AddOrderItemUseCase } from '../../application/commands/add-order-item.usecase';
import { ApplyDiscountUseCase } from '../../application/commands/apply-discount.usecase';
import { CancelOrderUseCase } from '../../application/commands/cancel-order.usecase';
import { CancelOrderItemUseCase } from '../../application/commands/cancel-order-item.usecase';
import { CreateOrderUseCase } from '../../application/commands/create-order.usecase';
import { EditOrderItemUseCase } from '../../application/commands/edit-order-item.usecase';
import { MarkOrderServedUseCase } from '../../application/commands/mark-order-served.usecase';
import { MoveOrderToTableUseCase } from '../../application/commands/move-order-to-table.usecase';
import { RemoveDiscountUseCase } from '../../application/commands/remove-discount.usecase';
import { RemoveOrderItemUseCase } from '../../application/commands/remove-order-item.usecase';
import { SendToKitchenUseCase } from '../../application/commands/send-to-kitchen.usecase';
import { UpdateOrderNoteUseCase } from '../../application/commands/update-order-note.usecase';
import { RecordPaymentUseCase } from '../../application/commands/record-payment.usecase';
import { VoidPaymentUseCase } from '../../application/commands/void-payment.usecase';
import { CloseOrderUseCase } from '../../application/commands/close-order.usecase';
import { SplitEvenUseCase } from '../../application/commands/split-even.usecase';
import { SplitItemsToNewCheckUseCase } from '../../application/commands/split-items-to-new-check.usecase';
import { GetReceiptUseCase } from '../../application/queries/get-receipt.usecase';
import {
  AddOrderItemDto,
  ApplyDiscountDto,
  CancelDto,
  CreateOrderDto,
  EditOrderItemDto,
  ListOrdersQuery,
  MoveTableDto,
  RecordPaymentDto,
  SplitEvenDto,
  SplitItemsDto,
  UpdateOrderDto,
  VoidPaymentDto,
} from '../../application/dto/order.dto';
import {
  OrderResponse,
  PaymentResponse,
  RecordPaymentResponse,
  ReceiptResponse,
  SplitEvenResponse,
  SplitItemsResponse,
} from '../../application/dto/responses';
import { GetOrderUseCase } from '../../application/queries/get-order.usecase';
import { ListOrdersUseCase } from '../../application/queries/list-orders.usecase';

const P = PERMISSIONS;

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly listOrders: ListOrdersUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly addItem: AddOrderItemUseCase,
    private readonly editItem: EditOrderItemUseCase,
    private readonly removeItem: RemoveOrderItemUseCase,
    private readonly sendToKitchen: SendToKitchenUseCase,
    private readonly applyDiscount: ApplyDiscountUseCase,
    private readonly removeDiscount: RemoveDiscountUseCase,
    private readonly cancelItem: CancelOrderItemUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly moveTable: MoveOrderToTableUseCase,
    private readonly markServed: MarkOrderServedUseCase,
    private readonly updateNote: UpdateOrderNoteUseCase,
    private readonly recordPayment: RecordPaymentUseCase,
    private readonly voidPayment: VoidPaymentUseCase,
    private readonly closeOrder: CloseOrderUseCase,
    private readonly splitEven: SplitEvenUseCase,
    private readonly splitItems: SplitItemsToNewCheckUseCase,
    private readonly getReceipt: GetReceiptUseCase,
  ) {}

  @Post()
  @RequirePermissions(P.ORDER_CREATE)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CREATE permission.' })
  @ApiOperation({ summary: 'Create an order (DINE_IN on a table auto-occupies it).' })
  @ApiCreatedResponse({ type: OrderResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponse> {
    const order = await this.createOrder.execute({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId ?? null,
      waiterId: user.sub,
      type: dto.type,
      tableId: dto.tableId ?? null,
    });
    return OrderResponse.from(order);
  }

  @Get()
  @ApiOperation({ summary: 'List orders (active by default; filters status/tableId/mine).' })
  @ApiOkResponse({ type: [OrderResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() query: ListOrdersQuery,
  ): Promise<Paginated<OrderResponse>> {
    const page = await this.listOrders.execute({
      restaurantId: tenant.restaurantId,
      status: query.status,
      tableId: query.tableId,
      mineUserId: query.mine === 'true' ? user.sub : undefined,
      activeOnly: query.includeInactive !== 'true',
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(OrderResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order with full breakdown.' })
  @ApiOkResponse({ type: OrderResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.getOrder.execute({ restaurantId: tenant.restaurantId, orderId: id });
    return OrderResponse.from(order);
  }

  @Patch(':id')
  @RequirePermissions(P.ORDER_EDIT)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Update order note.' })
  @ApiOkResponse({ type: OrderResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ): Promise<OrderResponse> {
    const order = await this.updateNote.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      note: dto.note ?? null,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/items')
  @RequirePermissions(P.ORDER_CREATE)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CREATE permission.' })
  @ApiOperation({ summary: 'Add an item to an order.' })
  @ApiCreatedResponse({ type: OrderResponse })
  async addOrderItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AddOrderItemDto,
  ): Promise<OrderResponse> {
    const order = await this.addItem.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      menuItemId: dto.menuItemId,
      quantity: dto.quantity,
      selectedOptionIds: dto.selectedOptionIds ?? [],
      note: dto.note ?? null,
    });
    return OrderResponse.from(order);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(P.ORDER_EDIT)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Edit a NEW item (before send-to-kitchen).' })
  @ApiOkResponse({ type: OrderResponse })
  async editOrderItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: EditOrderItemDto,
  ): Promise<OrderResponse> {
    const order = await this.editItem.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      itemId,
      quantity: dto.quantity,
      note: dto.note,
      selectedOptionIds: dto.selectedOptionIds,
    });
    return OrderResponse.from(order);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Remove a NEW item (before send-to-kitchen).' })
  @ApiOkResponse({ type: OrderResponse })
  async removeOrderItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<OrderResponse> {
    const order = await this.removeItem.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      itemId,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/send-to-kitchen')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Send NEW items to the kitchen.' })
  @ApiOkResponse({ type: OrderResponse })
  async send(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.sendToKitchen.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/discount')
  @RequirePermissions(P.DISCOUNT_APPLY)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing DISCOUNT_APPLY permission.' })
  @ApiOperation({ summary: 'Apply a discount.' })
  @ApiOkResponse({ type: OrderResponse })
  async discount(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: ApplyDiscountDto,
  ): Promise<OrderResponse> {
    const order = await this.applyDiscount.execute({
      restaurantId: tenant.restaurantId,
      organizationId: tenant.organizationId,
      orderId: id,
      type: dto.type,
      value: dto.value,
      approvedByUserId: dto.approvedByUserId ?? null,
      actorUserId: user.sub,
    });
    return OrderResponse.from(order);
  }

  @Delete(':id/discount')
  @RequirePermissions(P.DISCOUNT_APPLY)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing DISCOUNT_APPLY permission.' })
  @ApiOperation({ summary: 'Remove the discount.' })
  @ApiOkResponse({ type: OrderResponse })
  async clearDiscount(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.removeDiscount.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/items/:itemId/cancel')
  @RequirePermissions(P.ORDER_CANCEL)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CANCEL permission.' })
  @ApiOperation({ summary: 'Cancel a single item (reason required).' })
  @ApiOkResponse({ type: OrderResponse })
  async cancelOrderItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CancelDto,
  ): Promise<OrderResponse> {
    const order = await this.cancelItem.execute({
      restaurantId: tenant.restaurantId,
      organizationId: tenant.organizationId,
      orderId: id,
      itemId,
      reason: dto.reason,
      approvedByUserId: dto.approvedByUserId ?? null,
      actorUserId: user.sub,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/cancel')
  @RequirePermissions(P.ORDER_CANCEL)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CANCEL permission.' })
  @ApiOperation({ summary: 'Cancel the order (reason required); releases the table (auto mode).' })
  @ApiOkResponse({ type: OrderResponse })
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ): Promise<OrderResponse> {
    const order = await this.cancelOrder.execute({
      restaurantId: tenant.restaurantId,
      organizationId: tenant.organizationId,
      orderId: id,
      reason: dto.reason,
      cancelledByUserId: user.sub,
      approvedByUserId: dto.approvedByUserId ?? null,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/move-table')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Move the order to another table.' })
  @ApiOkResponse({ type: OrderResponse })
  async move(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MoveTableDto,
  ): Promise<OrderResponse> {
    const order = await this.moveTable.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      tableId: dto.tableId,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/serve')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Mark the order as SERVED.' })
  @ApiOkResponse({ type: OrderResponse })
  async serve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.markServed.execute({ restaurantId: tenant.restaurantId, orderId: id });
    return OrderResponse.from(order);
  }

  @Post(':id/payments')
  @RequirePermissions(P.PAYMENT_PROCESS)
  @HttpCode(201)
  @ApiForbiddenResponse({ description: 'Missing PAYMENT_PROCESS permission.' })
  @ApiOperation({ summary: 'Record a manual payment (partial/multiple allowed).' })
  @ApiCreatedResponse({ type: RecordPaymentResponse })
  async addPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<RecordPaymentResponse> {
    const result = await this.recordPayment.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      method: dto.method,
      amount: dto.amount,
      tenderedAmount: dto.tenderedAmount ?? null,
      processedByUserId: user.sub,
    });
    return {
      payment: PaymentResponse.from(result.payment),
      changeAmount: result.changeAmount,
      order: OrderResponse.from(result.order),
    };
  }

  @Post(':id/payments/:paymentId/void')
  @RequirePermissions(P.PAYMENT_PROCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing PAYMENT_PROCESS permission.' })
  @ApiOperation({ summary: 'Void an active payment.' })
  @ApiOkResponse({ type: OrderResponse })
  async voidOrderPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: VoidPaymentDto,
  ): Promise<OrderResponse> {
    const order = await this.voidPayment.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      paymentId,
      reason: dto.reason ?? null,
      voidedByUserId: user.sub,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/close')
  @RequirePermissions(P.PAYMENT_PROCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing PAYMENT_PROCESS permission.' })
  @ApiOperation({ summary: 'Close a fully-paid order; table -> CLEANING (auto mode, last check).' })
  @ApiOkResponse({ type: OrderResponse })
  async close(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.closeOrder.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      actorUserId: user.sub,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/split-even')
  @RequirePermissions(P.PAYMENT_PROCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing PAYMENT_PROCESS permission.' })
  @ApiOperation({ summary: 'Even-split calculator (shares sum exactly to total). Stateless.' })
  @ApiOkResponse({ type: SplitEvenResponse })
  async splitEvenShares(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SplitEvenDto,
  ): Promise<SplitEvenResponse> {
    return this.splitEven.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      parts: dto.parts,
    });
  }

  @Post(':id/split-items')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(201)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Move items to a new linked child check (shares the table).' })
  @ApiCreatedResponse({ type: SplitItemsResponse })
  async splitToNewCheck(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SplitItemsDto,
  ): Promise<SplitItemsResponse> {
    const result = await this.splitItems.execute({
      restaurantId: tenant.restaurantId,
      orderId: id,
      itemIds: dto.itemIds,
    });
    return {
      sourceOrder: OrderResponse.from(result.sourceOrder),
      newCheck: OrderResponse.from(result.newCheck),
    };
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Structured receipt (serviceFee its own line; NO tax).' })
  @ApiOkResponse({ type: ReceiptResponse })
  async receipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReceiptResponse> {
    return this.getReceipt.execute({ restaurantId: tenant.restaurantId, orderId: id });
  }
}
