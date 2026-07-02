import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectApiHealth } from '../../helpers/health';
import {
  cancelOrder,
  changeTableStatus,
  createDineInOrder,
  createTable,
  getOrder,
  getTable,
  listActiveOrdersForTable,
  listFloors,
  listTables,
  moveOrderToTableRaw,
  parseJsonBody,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const TABLES = [
  {
    name: 'E2E Move Conflict Source',
    qrIdentifier: 'e2e-move-conflict-source',
  },
  {
    name: 'E2E Move Conflict Target',
    qrIdentifier: 'e2e-move-conflict-target',
  },
] as const;

const ACTIVE_ORDER_STATUSES = new Set([
  'DRAFT',
  'SENT_TO_KITCHEN',
  'PREPARING',
  'READY',
  'SERVED',
]);

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

async function ensureTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { name: string; qrIdentifier: string },
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) => table.qrIdentifier === input.qrIdentifier || table.name === input.name,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error(`Cannot create ${input.name}: GET /floors returned no floors.`);
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: input.name,
    seatCapacity: 2,
    qrIdentifier: input.qrIdentifier,
  });
}

async function resetOrderTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E move-table conflict setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    [
      `Move-table setup could not clear active orders for table ${table.id}.`,
      `table name: ${table.name}`,
      `remaining order ids/statuses: ${remaining.map((order) => `${order.id}:${order.status}`).join(', ') || '<none>'}`,
    ].join('\n'),
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }
  return current;
}

function errorCode(text: string): string | undefined {
  const body = parseJsonBody<ApiErrorBody>(text, 'POST /orders/:id/move-table conflict');
  return body.error?.code ?? body.code;
}

function expectActiveDineInOrder(order: OrderResponse, tableId: string, label: string): void {
  expect(order.id, `${label} should still exist.`).toBeTruthy();
  expect(order.tableId, `${label} should stay assigned to its original table.`).toBe(tableId);
  expect(order.status, `${label} should remain active.`).toBeTruthy();
  expect(ACTIVE_ORDER_STATUSES.has(order.status as string), `${label} should not be terminal.`).toBeTruthy();
}

test.describe('order move-table API conflict', () => {
  test('rejects moving an active dine-in order onto a table with another active order', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;

    await expectApiHealth(request, { label: 'primary API for move-table conflict' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const [sourceTable, targetTable] = await Promise.all(
      TABLES.map((table) => ensureTable(request, auth, table)),
    );
    const [cleanSourceTable, cleanTargetTable] = [
      await resetOrderTable(request, auth, sourceTable),
      await resetOrderTable(request, auth, targetTable),
    ];

    expect(cleanSourceTable.status, `Source table ${cleanSourceTable.id} must start AVAILABLE.`).toBe(
      'AVAILABLE',
    );
    expect(cleanTargetTable.status, `Target table ${cleanTargetTable.id} must start AVAILABLE.`).toBe(
      'AVAILABLE',
    );

    const createdOrderIds: string[] = [];
    try {
      const sourceOrder = await createDineInOrder(request, auth, cleanSourceTable.id);
      createdOrderIds.push(sourceOrder.id);
      const targetOrder = await createDineInOrder(request, auth, cleanTargetTable.id);
      createdOrderIds.push(targetOrder.id);

      expectActiveDineInOrder(sourceOrder, cleanSourceTable.id, `Source order ${sourceOrder.id}`);
      expectActiveDineInOrder(targetOrder, cleanTargetTable.id, `Target order ${targetOrder.id}`);

      const sourceBeforeMove = await getTable(request, auth, cleanSourceTable.id);
      const targetBeforeMove = await getTable(request, auth, cleanTargetTable.id);
      expect(sourceBeforeMove.status, `Source table ${cleanSourceTable.id} should be OCCUPIED before move.`).toBe(
        'OCCUPIED',
      );
      expect(targetBeforeMove.status, `Target table ${cleanTargetTable.id} should be OCCUPIED before move.`).toBe(
        'OCCUPIED',
      );

      const rejectedMove = await moveOrderToTableRaw(
        request,
        auth,
        sourceOrder.id,
        cleanTargetTable.id,
      );
      expect(
        rejectedMove.ok,
        `Move-table conflict should be rejected, got ${rejectedMove.status}: ${rejectedMove.text}`,
      ).toBeFalsy();
      expect(rejectedMove.status, `Move-table conflict should return HTTP 409: ${rejectedMove.text}`).toBe(
        409,
      );
      expect(errorCode(rejectedMove.text), `Move-table conflict should use TABLE_HAS_OPEN_ORDER.`).toBe(
        'TABLE_HAS_OPEN_ORDER',
      );

      const sourceAfterMove = await getOrder(request, auth, sourceOrder.id);
      const targetAfterMove = await getOrder(request, auth, targetOrder.id);
      expectActiveDineInOrder(sourceAfterMove, cleanSourceTable.id, `Source order ${sourceOrder.id}`);
      expectActiveDineInOrder(targetAfterMove, cleanTargetTable.id, `Target order ${targetOrder.id}`);

      const sourceTableAfterMove = await getTable(request, auth, cleanSourceTable.id);
      const targetTableAfterMove = await getTable(request, auth, cleanTargetTable.id);
      expect(
        sourceTableAfterMove.status,
        `Rejected move should leave source table ${cleanSourceTable.id} status unchanged.`,
      ).toBe('OCCUPIED');
      expect(
        targetTableAfterMove.status,
        `Rejected move should leave target table ${cleanTargetTable.id} status unchanged.`,
      ).toBe('OCCUPIED');

      const sourceActiveOrders = await listActiveOrdersForTable(request, auth, cleanSourceTable.id);
      const targetActiveOrders = await listActiveOrdersForTable(request, auth, cleanTargetTable.id);
      expect(
        sourceActiveOrders.map((order) => order.id),
        `Source table ${cleanSourceTable.id} should still have exactly source order ${sourceOrder.id}.`,
      ).toEqual([sourceOrder.id]);
      expect(
        targetActiveOrders.map((order) => order.id),
        `Target table ${cleanTargetTable.id} should not receive duplicate active orders.`,
      ).toEqual([targetOrder.id]);
    } finally {
      for (const orderId of createdOrderIds) {
        const order = await getOrder(request, auth, orderId).catch(() => null);
        if (order?.status && ACTIVE_ORDER_STATUSES.has(order.status)) {
          await cancelOrder(request, auth, order.id, 'E2E move-table conflict cleanup');
        }
      }

      await resetOrderTable(request, auth, cleanSourceTable);
      await resetOrderTable(request, auth, cleanTargetTable);
    }
  });
});
