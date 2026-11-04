# iiko permissions vs Restaurant OS

Source: iikoChain 9.2 (Bek Beer), *Employees → Administration → Permissions*, read on 2026-09-25. Nothing was changed in iiko.

iiko has 12 positions (ADM, BL1, BR1, CO1, CS1, DASH, DW1, FFC, MN0, MN1, SG1, WR1) and ~330 rights. The prefixes are: `B_` back office, `F_` front office (POS), `D_` delivery, `B_IC_` loyalty cards, `S_` system, `PS_` payment systems.

## Added in IIKO-PERM-1

Each new key splits an existing, broader permission. Migration `20260926000000_iiko_permission_parity` gives every new key to each role (system or custom) that already had the parent key, so existing staff keep the same access until an admin removes the new key.

| New key | iiko | Parent (backfill) | Enforced on |
|---|---|---|---|
| `order:edit_others` | F_AOT | ORDER_EDIT | Every mutating `/orders/:id/*` route (`OrderOwnershipGuard`). Without it, a user can change only their own orders and orders with no waiter. |
| `order:move_table` | F_CMP / F_MPR | ORDER_EDIT | `POST /orders/:id/move-table`, POS "Move table" button |
| `payment:void` | F_STRN / F_CCB | PAYMENT_PROCESS | `POST /orders/:id/payments/:pid/void`, POS void button |
| `fiscal:receipt:print` | F_FRC / F_FISC_BP | PAYMENT_PROCESS | `POST /orders/:id/fiscalize`, `GET /orders/:id/fiscal-receipt`, POS fiscal card |
| `menu:stop_list` | F_EM | MENU_MANAGE (+ CHEF, SOUS_CHEF) | `PATCH /menu/items/:id/availability`, admin availability toggle |
| `reports:profit:view` | B_VPLR | REPORTS_VIEW | `GET /reports/profit`, `/reports/profit/export`, admin Profit tab and full export |
| `finance:expense:read` | B_FIN | inventory:read | `GET /expenses`, `GET /expense-categories` |
| `finance:expense:manage` | B_ECB | inventory:writeoff:create | expense and category create/edit |
| `finance:expense:delete` | B_ECB | inventory:writeoff:void | expense and category delete |
| `user:view` | B_VE | USER_MANAGE | `GET /users`, `GET /users/:id`, `GET /users/:id/branch-memberships`; the admin Users page is read-only without USER_MANAGE |
| `inventory:supplier:manage` | B_CTR / B_SUPP | inventory:item:manage | supplier create/edit/delete |

Already covered before this change: F_KDS→KDS_ACCESS, F_CASH→PAYMENT_PROCESS, F_ID/F_IDNC→DISCOUNT_APPLY, F_CHO→ORDER_CREATE, B_CHL→menu:item:set_price, B_EP→ROLE_MANAGE, B_EE→USER_MANAGE, B_VTJ→AUDIT_VIEW, F_ERS→RESERVATION_MANAGE, B_ESI→inventory:receipt:create, B_WOFFC/B_WOFFR→writeoff:create, B_WOFFE→writeoff:void, B_INTINVC→transfer:create, B_CI/B_PI→adjustment:create, B_EAC→recipe:manage, B_PRODNC→process:manage/run, F_XR→reports:shift:view, S_TERM→device.enroll, F_OPIN→staff.pin.manage.

## Not added: we don't have these features yet

Following the "enforceable only" decision, these iiko rights have no key yet. Each one belongs with the feature when it is built.

- **Till / cash shifts:** F_OCS, F_OSE, F_CS, F_CSE, F_CSUO, F_CSUUO, F_XR/F_ZREP (Z-report), F_APIO/B_APIO (cash in/out), F_DR (open drawer), B_ACO/B_ACS/B_VCS. Biggest gap for cashier control.
- **Refund against a closed receipt:** F_STRN, F_SWWOFF, F_DCO (delete closed orders), F_CLOR/F_CLOS (view closed orders and amounts), F_CPBA/F_PA (reprint bill/items). The GET receipt route has no gate today.
- **Printed-item rules:** F_DP (delete printed items), F_DNPI, F_CCCP (change comments on printed items), F_CGC (guest count). Removing items already sent to the kitchen goes only through ORDER_CANCEL.
- **Other waiters' visibility:** F_SWA (turnover of other waiters), F_SWD (debts of all waiters), F_CPOTB (print bill for others), F_COW (transfer order to another waiter).
- **Clock-in / attendance / payroll:** F_KIS, F_COWD, F_CWAUS, F_CVS, F_VOS, F_VPSD, B_TIME, B_SCHED, B_PAY, B_EPP, B_VPP, B_EAP, B_BAP, B_EEP, B_REP, B_MED, B_CVAT/B_CVBT/B_CVEJ/B_CVPT/B_CVR/B_CVST.
- **Prepayments / credit / tips:** F_PRPRE, F_REP, F_VP, F_COC, F_CWC, F_ACO, F_COTH (on the house), B_CET (tips), B_SCH (service fee).
- **Purchasing / documents:** B_INVC/B_INVR/B_INVE/B_INVP/B_INVV (invoices), B_RINVC/R/V (returns), B_OINVE, B_PRORF/B_PRORT/B_PRB (orders to suppliers), B_PREPORT, B_TID, B_INB, B_WNB, B_CEDN/B_CEDT (edit doc number and time), B_CCLP/B_VCPS/B_WCP (period lock), B_WWCD.
- **Finance / accounting:** B_ECOA/B_VCOA, B_ECFA, B_VBALR, B_VCFR, B_ESP/B_VSP/B_ESPR/B_VSPR/B_VSPC, B_BKE/B_BKI, B_EAS, B_BUD_*.
- **Price lists / schedules:** B_ROMENOR/B_MENOR/B_PMENOR, B_IPLV, F_IPS, B_QMENU.
- **Delivery (whole D_ group):** D_AC … D_SFN (drivers, delivery, customer phone, street book).
- **Loyalty cards (whole B_IC_ group):** plus F_IDCN/F_IDGC/F_BGCN/F_EOWCC, F_SC, D_DOCN.
- **Guests / CRM:** B_GUEST, B_EGL (export guests), D_AHR.
- **Reservations:** F_VRS/F_VRRP (view-only reservations and reservation reports). Needs a `reservation:view` key; today the reservations GET routes have no gate at all.
- **Equipment / terminal:** F_HS, F_SET, F_EKDS (KDS settings), F_CST, F_RUOFF, F_EBC, F_CW, F_EFA, F_ECL.
- **Plugins / API / system:** F_SAP, F_SPB, F_SUP, S_API, S_FRN_*, PS_ADM, B_ADM, B_DB, B_EXC, B_SYNC_MON, B_LFO, B_LIDJ, B_VLV, B_EA.
- **Reports:** B_RPT, B_ESOR/B_VOTR (OLAP), B_EREPORT/B_VREPORT (custom reports), B_CASR, F_VRPT, F_REREP. REPORTS_VIEW covers these roughly today.

## Next suggested keys (when their features land)

`shift:open`, `shift:close`, `shift:z_report`, `cash:in_out`, `order:item:delete_sent`, `order:reopen`, `receipt:reprint`, `order:view_closed`, `reservation:view`, `attendance:manage`, `delivery:*`, `loyalty:*`.
