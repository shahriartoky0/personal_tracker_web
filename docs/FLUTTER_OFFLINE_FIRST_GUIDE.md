# Taka Tracker — Flutter mobile app: offline-first implementation guide

Audience: the engineer/agent building the Flutter (Android + iOS) client for the existing Taka Tracker backend.
Status: specification. Nothing here is implemented yet. The web app (Next.js) and the Supabase project already exist and are the source of truth for **behaviour** (business rules) and **data** (Postgres + RLS).

**Read first:** `README.md` (web architecture), `supabase/migrations/*.sql` (schema), `src/shared/domain/*` and `src/features/*/domain/*` (the rules you must port), `src/tests/unit/*` (test vectors you must reproduce).

---

## 0. The one-paragraph design

The phone has its **own SQLite database (Drift, encrypted)** that the UI reads and writes exclusively. Every user action is validated by a **pure-Dart domain layer** (a port of the web domain), written to SQLite and appended to an **outbox** in the *same local transaction*, and the UI updates instantly from Drift streams. A **sync engine** pushes the outbox to Supabase (idempotent upserts with client-generated UUIDs) and pulls remote changes (keyset-paginated deltas + delete tombstones) whenever connectivity allows. The app is fully usable with no network after the first sign-in. Money is integer minor units, "which day does this belong to" is computed from the profile timezone, and balances/reports are always **derived locally** — never stored or synced.

```
 UI (Riverpod) ──watch──► Drift (SQLite, source of truth on device)
   │  actions                  ▲ apply pulled changes
   ▼                           │
 Use cases (domain, pure Dart) │
   │ 1 local txn: row + outbox │
   ▼                           │
 Outbox ──push──► Supabase (PostgREST / Storage, RLS) ──pull deltas──┘
```

Non-goals for v1: bank/wallet sync, multi-user households, server-side computation of reports.

---

## 1. Scope and parity with the web app

The mobile app must provide the same MVP (see root brief §3–§5, §22): Dashboard ("Left for today" dominant), Plan Today, Quick Add Expense/Income, Transfers between own accounts, **Transfers to/from people (with optional proof)** and their tracker, Transactions (search/filters/edit/delete/duplicate), Reports (period presets, custom range, donut/trend/planned-vs-actual/comparison, CSV export), Settings (profile, currency, timezone, accounts, categories, reminders, export, delete data/account).

Mobile-specific additions: offline operation, sync status UI, biometric app lock, local notifications for reminders and budget alerts, camera capture for proofs, share-sheet CSV export.

Business rules are **not** to be re-designed; port them (section 5).

---

## 2. Backend contract (what you are syncing with)

Single Supabase project. Client uses the **publishable key** only; never ship a service-role key. All data access is user-scoped by RLS (`user_id = auth.uid()`).

| Table | Key columns (server) | Notes |
|---|---|---|
| `profiles` | `id`(=auth uid), `display_name`, `currency`(3 chars, default BDT), `timezone`(default Asia/Dhaka), `preferences jsonb`, `updated_at` | Created by signup trigger. Never deleted by clients. |
| `accounts` | `id uuid`, `user_id`, `name`, `type`(cash/bank/card/mobile/other), `opening_balance bigint`, `is_archived` | `unique(id,user_id)` |
| `categories` | `id`, `user_id`, `name`, `icon`, `color`, `type`(income/expense), `is_default`, `is_archived` | Archived, never hard-deleted by the app. |
| `payees` | `id`, `user_id`, `name`, `is_archived` | **Unique per user on `lower(name)`.** |
| `daily_budgets` | `id`, `user_id`, `budget_date date`, `total_limit`, `original_limit`, `notes`, `is_closed`, `closed_at`, `updated_at` | **Unique `(user_id, budget_date)`.** `original_*` must never change after creation. |
| `budget_allocations` | `id`, `user_id`, `daily_budget_id`, `category_id`, `planned_amount`, `original_amount` | `unique(daily_budget_id, category_id)`; cascades with the budget. |
| `budget_templates` | `id`, `user_id`(unique), `total_limit`, `allocations jsonb [{categoryId, amount}]`, `updated_at` | One per user. |
| `planned_expenses` | `id`, `user_id`, `planned_date`, `category_id`, `title`, `expected_amount`, `status`(planned/completed/skipped) | |
| `transactions` | `id`, `user_id`, `account_id`, `category_id?`, `payee_id?`, `type`(income/expense/transfer/person_transfer), `transfer_direction?`(in/out), `transfer_group_id?`, `amount bigint > 0`, `occurred_at timestamptz`, `merchant?`, `note?`, `planned_status`, `receipt_path?`, `updated_at` | See shape rules below. |
| `reminder_preferences` | `id`, `user_id`, `reminder_type`(plan_day/close_day/budget_threshold), `enabled`, `reminder_time`, `threshold_percent` | `unique(user_id, reminder_type)` |

**Composite FKs:** every child reference is `(child_id, user_id) → parent(id, user_id)`; a row can never point at another user's parent. Sending a wrong `user_id` is rejected by RLS.

**`transactions` shape check (CHECK constraint — violating it makes the insert fail permanently):**
- `income`/`expense`: `category_id` set; `transfer_direction`, `transfer_group_id`, `payee_id` null.
- `transfer` (between own accounts): `transfer_direction` + `transfer_group_id` set; `category_id`, `payee_id` null. Two rows per transfer (out on source account, in on destination) sharing `transfer_group_id`, same amount and time.
- `person_transfer` (to/from a person): `transfer_direction` + `payee_id` set; `category_id`, `transfer_group_id` null.

**Functions:** `create_transfer(p_from,p_to,p_amount,p_occurred_at,p_note)` (atomic pair; **do not use offline** — the client creates both rows itself, in one batched insert, see 8.5).

**Storage:** private bucket `receipts`, objects at `<userId>/<uuid>.<ext>`, jpeg/png/webp ≤ 5 MB (the web app caps at 4 MB). Storage RLS: only the owner's folder.

**Auth:** Supabase email/password. Email confirmation is on in production. Redirect links use the web `/auth/callback`; for mobile register a deep link (`io.yourorg.taka://auth-callback`) in Supabase Auth → URL Configuration.

**Money & time:** all amounts are integer minor units (poisha, 2 decimals for every currency). `occurred_at` is a UTC instant; `budget_date`/`planned_date` are timezone-free calendar dates.

---

## 3. Required backend change for sync (do this before the client work)

Today the schema cannot answer "what changed since X" or "what was deleted": several tables lack `updated_at`, and deletes are hard deletes. Add **sync support** as a new migration (appendix A has the full SQL). Summary:

1. `updated_at timestamptz not null default now()` + `BEFORE UPDATE` trigger on every synced table (the existing `public.set_updated_at()` is reused). Index `(user_id, updated_at, id)`.
2. `sync_tombstones(id, user_id, table_name, row_id, deleted_at)` filled by an `AFTER DELETE` trigger on each synced table (security definer, clients can only `select` their own). This keeps hard deletes (no web code changes) while letting devices learn about deletions. Cascaded deletes (budget → allocations) fire the trigger too.
3. Immutability trigger so `original_limit` / `original_amount` can't be changed after insert (variance reporting depends on it; today only the client enforces it).
4. Optional: add the tables to the `supabase_realtime` publication for live multi-device updates.

Do **not** switch the web app to soft deletes; tombstones are enough and non-invasive. Keep tombstones ≥ 90 days (a device offline longer than that must do a full re-bootstrap — see 9.5).

---

## 4. Architecture

### 4.1 Layers (mirror the web app)

Same Clean Architecture rules as the web brief, translated:

- `domain/` — **pure Dart, no Flutter, no Drift, no Supabase.** Entities, value objects (`Money`, `LocalDate`), calculators, use cases, repository interfaces.
- `data/` — Drift DAOs/tables, remote datasources (Supabase), mappers (DB row ⇄ domain entity ⇄ server JSON), repository implementations, **sync engine**.
- `presentation/` — widgets, Riverpod providers/notifiers, forms. **UI never touches Drift DAOs or Supabase directly; it calls use cases / repositories through providers.**

Rules: one implementation of each financial calculation (domain), reused by dashboard/reports/tests; typed `Result`/failures for expected errors; map at boundaries; no raw DB/Supabase errors shown to users.

### 4.2 Folder structure

```
lib/
  main.dart
  app/                       # MaterialApp.router, theme (design tokens), routes, DI bootstrap
  core/
    domain/                  # Money, LocalDate, tz utils, Result/Failure, ids
    data/
      db/                    # Drift database, tables, migrations, encryption
      sync/                  # outbox, push, pull, conflict, scheduler, status
      remote/                # supabase client factory, error classifier
    platform/                # connectivity, notifications, secure storage, biometrics, files
  features/
    accounts/ categories/ transactions/ budgets/ reports/
    transfers/               # payees, person transfers, proofs, tracker
    settings/ auth/
      domain/ data/ presentation/
test/                        # unit (domain), db, sync, widget, golden-parity fixtures
integration_test/            # end-to-end incl. airplane-mode flows
assets/fonts/                # Inter + Noto Sans Bengali (bundled — offline!)
```

### 4.3 Packages (pin latest stable at build time)

`supabase_flutter`, `drift` + `drift_flutter` + `sqlcipher_flutter_libs` (encrypted SQLite; `drift_dev`, `build_runner` for codegen), `flutter_riverpod`, `go_router`, `uuid`, `intl`, `timezone` + `flutter_timezone`, `connectivity_plus`, `workmanager`, `flutter_local_notifications`, `flutter_secure_storage`, `local_auth`, `image_picker`, `flutter_image_compress`, `path_provider`, `fl_chart`, `share_plus`, `csv`, `package_info_plus`. Test: `flutter_test`, `mocktail`, `integration_test`. Optional: `sentry_flutter`.

Prefer sealed classes/records (Dart 3) over code-gen models to keep the domain dependency-free.

---

## 5. Domain port (must match the web app exactly)

Port these modules from TypeScript; keep names identical so cross-reading is easy.

| Web source | Dart port | Key rules |
|---|---|---|
| `shared/domain/money.ts` | `Money` helpers on `int` | `parseMoney` parses the **digit string** (never `double`); max 13 integer digits & 2 decimals; `MAX_MINOR = 1e12`; `formatMoney` shows `৳1,250` / `৳1,250.50`, true minus `−`; `percentOf`/`percentChange` integer-rounded; `toDecimalString`. |
| `shared/domain/dates.ts` | `LocalDate` (`YYYY-MM-DD` string wrapper) + tz utils | `localDateOf(instant, tz)`, `startOfDayInstant`, `instantRange(from,to,tz)` (half-open `[start,end)`), `addDays/addMonths/endOfMonth/startOfWeek(Mon)`, `rangeForPreset`, `previousRange`, `zonedLocalToInstant` / `instantToZonedLocal` (for the date-time picker). Use `package:timezone` initialised with the tz database; handle DST. |
| `shared/domain/result.ts` | `sealed class Result<T>` + `Failure(code,message,fields)` | codes: validation / not_found / conflict / forbidden / unexpected. |
| `transaction-calculator.ts` | `TransactionCalculator` | expense/income/transfer/person_transfer classification; `totalExpenses`, `totalIncome`, `totalUnplanned`, `totalSentToPeople`, `totalReceivedFromPeople`, `netCashFlow`, `onLocalDate`, `balanceEffect`. **Transfers and person transfers are never income/expense.** |
| `budget-calculator.ts` | `BudgetCalculator` | `summarizeDay` (remaining = limit − spent, may be negative; status none/ok/approaching/over; threshold compare `spent*100 >= warn*limit`), `validateAllocations`, `plannedVsActual`. |
| `balance.ts` | `BalanceCalculator` | `accountBalance = opening + Σ balanceEffect`, `totalBalance` (optionally `before` an instant). Balances are **derived**, never stored. |
| `period-report.ts` | `PeriodReportBuilder` | opening/closing balance, flows, category/payment-method shares, trend buckets (daily ≤ 45 days else weekly), top merchants, planned-vs-actual, previous-period comparison, `sentToPeople`/`receivedFromPeople`. |
| `transfer-tracker.ts` | `TransferTrackerBuilder` | period + all-time per-person totals, newest-first history. |
| `csv.ts` | `TransactionCsv` | header `Date,Time,Type,Amount,Category,Account,Planned,Person,Merchant,Note,Transfer group`; signed amounts; formula-injection guard on text columns only; CRLF; add UTF-8 BOM when writing the file. |
| use cases | `CreateExpense`, `CreateIncome`, `CreateTransfer`, `RecordPersonTransfer`, `UpdateTransaction`, `UpdatePersonTransfer`, `DeleteTransaction`, `DuplicateTransaction`, `CreateDailyBudget`, `CopyPreviousPlan`, `CloseDailyBudget`, … | Same validations and error messages. Person transfers resolve/create the payee by case-insensitive name; an archived payee is restored when reused. |

**Parity testing (mandatory):** export the web unit tests' scenarios as JSON fixtures (inputs + expected outputs — e.g. the late-night Dhaka transaction, DST days in New_York, leap years, transfer exclusion, plan edit preserving originals, tracker all-time totals, CSV lines) into `test/fixtures/parity/*.json`, and run the same cases in Dart. Add a CI check that fails when a fixture changes without both sides updated.

---

## 6. Local database (Drift)

### 6.1 Principles

- UUIDs are generated **on the device** (`uuid.v4()`), and are the same ids stored on the server — no id remapping except unique-constraint collisions (8.6).
- Store money as `INTEGER` minor units, instants as `INTEGER` UTC epoch **milliseconds** (keep the original ISO string only if you need microsecond fidelity — you don't), dates as `TEXT 'YYYY-MM-DD'`.
- Every synced table carries sync metadata. The server's `updated_at` string is kept **verbatim** (opaque cursor value; don't parse/round it).
- Encrypt at rest (SQLCipher). The key is generated on first launch and kept in `flutter_secure_storage` (Keystore/Keychain). Losing the key = local DB unreadable → treat as "re-bootstrap from server" (only safe if the outbox was empty; see 12.3).
- Foreign keys **off** during pull-apply (or apply in dependency order inside one transaction) — rows can arrive in any order across pages.

### 6.2 Table sketch

```dart
mixin SyncColumns on Table {
  TextColumn get id => text()();                        // client-generated UUID == server id
  TextColumn get remoteUpdatedAt => text().nullable()(); // raw server timestamptz; null = never synced
  BoolColumn get pending => boolean().withDefault(const Constant(false))(); // has unsent local changes
  @override Set<Column> get primaryKey => {id};
}

class Accounts extends Table with SyncColumns {
  TextColumn get name => text()();
  TextColumn get type => text()();
  IntColumn get openingBalance => integer().withDefault(const Constant(0))();
  BoolColumn get isArchived => boolean().withDefault(const Constant(false))();
}

class Transactions extends Table with SyncColumns {
  TextColumn get accountId => text()();
  TextColumn get categoryId => text().nullable()();
  TextColumn get payeeId => text().nullable()();
  TextColumn get type => text()();                       // income|expense|transfer|person_transfer
  TextColumn get transferDirection => text().nullable()();
  TextColumn get transferGroupId => text().nullable()();
  IntColumn get amount => integer()();                   // > 0, minor units
  IntColumn get occurredAtMs => integer()();             // UTC epoch ms
  TextColumn get merchant => text().nullable()();
  TextColumn get note => text().nullable()();
  TextColumn get plannedStatus => text().withDefault(const Constant('unplanned'))();
  TextColumn get receiptPath => text().nullable()();     // server storage path (set at enqueue time)
  TextColumn get receiptLocalFile => text().nullable()();// device file until uploaded
}
// + Categories, Payees, DailyBudgets, BudgetAllocations, BudgetTemplates,
//   PlannedExpenses, ReminderPreferences, Profile (single row)

class Outbox extends Table {
  IntColumn get seq => integer().autoIncrement()();       // strict FIFO
  TextColumn get entity => text()();                      // table name
  TextColumn get entityId => text()();
  TextColumn get op => text()();                          // upsert | delete | upload_proof | delete_proof
  TextColumn get payload => text()();                     // full server-shaped JSON row, or {path,localFile}
  TextColumn get baseUpdatedAt => text().nullable()();    // remoteUpdatedAt the edit was based on
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  IntColumn get nextAttemptAtMs => integer().withDefault(const Constant(0))();
  TextColumn get status => text().withDefault(const Constant('pending'))(); // pending|in_flight|failed|blocked
  TextColumn get lastError => text().nullable()();
  IntColumn get createdAtMs => integer()();
}

class SyncCursors extends Table {   // one row per synced table
  TextColumn get entity => text()();
  TextColumn get updatedAt => text().nullable()();        // keyset cursor (raw server string)
  TextColumn get lastId => text().nullable()();
  IntColumn get lastSuccessMs => integer().nullable()();
  @override Set<Column> get primaryKey => {entity};
}

class ConflictLog extends Table {   // never silently lose data
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entity => text()();
  TextColumn get entityId => text()();
  TextColumn get serverVersionJson => text()();           // what we overwrote / what we discarded
  TextColumn get resolution => text()();                  // local_won | server_won | merged
  IntColumn get atMs => integer()();
}
```

Indexes: `transactions(occurred_at_ms)`, `(account_id)`, `(category_id)`, `(payee_id)`, `(type)`; `outbox(status, next_attempt_at_ms, seq)`; `daily_budgets(budget_date)` unique.

### 6.3 Migrations

Drift `schemaVersion` + stepwise migrations with generated schema tests (`drift_dev schema`). A local schema migration must never drop the outbox. Add a **server schema compatibility check** at startup: a tiny RPC/table `app_config(min_client_version, schema_version)`; if the client is too old, show "Update required" and stop syncing (but keep working offline and keep the outbox).

---

## 7. Offline write path (the pattern for *every* mutation)

1. **Validate** with the domain use case (identical rules and messages as the web app). Return `Failure` with field errors to the form.
2. **One Drift transaction:** write/update the local row (`pending = true`) **and** append the outbox op(s) with the full server-shaped JSON. All-or-nothing — never one without the other.
3. **Kick the sync engine** (non-blocking). UI is already updated through `watch()` streams.
4. Show a subtle "pending" indicator on the row until the push succeeds.

```dart
Future<Result<Transaction>> createExpense(ExpenseInput i) async {
  final failure = validateExpense(i, accounts: await _accounts.active(), categories: await _cats.active());
  if (failure != null) return Err(failure);

  final id = _uuid.v4();
  final row = TransactionRow(
    id: id, accountId: i.accountId, categoryId: i.categoryId, type: 'expense',
    amount: i.amount, occurredAtMs: i.occurredAt.millisecondsSinceEpoch,
    merchant: _trim(i.merchant), note: _trim(i.note),
    plannedStatus: i.plannedStatus ?? 'unplanned', pending: true,
  );
  await db.transaction(() async {
    await txDao.upsert(row);
    await outbox.enqueueUpsert('transactions', id, row.toServerJson(userId: session.userId));
  });
  sync.kick();
  return Ok(row.toDomain());
}
```

Notes:
- `toServerJson` must include `user_id` (RLS `with check`), ISO-8601 UTC `occurred_at`, and **exactly** the columns the CHECK shape expects (e.g. `payee_id: null` on an expense is fine; an expense with a `transfer_direction` is not).
- **Idempotency:** the UUID is the identity; the push uses `upsert(onConflict: 'id')`, so retries after a timeout can't duplicate.
- **Outbox coalescing** (in `enqueue*`, same local transaction): a new `upsert` for an entity that already has a *pending* (not in-flight) `upsert` replaces its payload; `delete` after a never-synced `upsert` removes both (nothing ever reached the server); `delete` after a synced upsert replaces the upsert with the delete. This keeps the queue small after long offline stretches.
- **Never** write balances, "left for today" or any aggregate — derive from rows.

### 7.1 Per-feature write recipes

| Action | Local rows | Outbox ops (in order) |
|---|---|---|
| Add/edit/delete expense or income | 1 `transactions` row | 1 upsert / delete |
| Duplicate | new row, new UUID | 1 upsert |
| Transfer between own accounts | **2** rows (out + in), same `transfer_group_id` (client UUID) | one **batched** upsert op containing both rows (single PostgREST request = single DB transaction) |
| Delete own-account transfer | delete both rows of the group | 2 delete ops queued together |
| Person transfer (sent/received) | find-or-create `payees` row (case-insensitive name) + 1 `transactions` row | upsert payee (if new) → upsert transaction → (proof ops, see 13) |
| Edit person transfer | update row; payee find-or-create if name changed | upserts (+ proof ops) |
| Daily plan save | upsert `daily_budgets` (never touch `original_*` on an existing row) + upsert/delete `budget_allocations` | budget upsert → allocation upserts/deletes |
| Close/reopen day | update `is_closed`, `closed_at` | upsert budget |
| Template save | upsert the single `budget_templates` row | 1 upsert |
| Planned expense add/status/delete | `planned_expenses` row | upsert / delete |
| Account/category/payee add, rename, archive | row | upsert (archive = `is_archived` flag, not delete) |
| Profile (currency, timezone, name) / reminders | single row / by type | upsert |
| "Delete all transactions & plans" | delete local rows | one `rpc`-free approach: queue deletes per row, **or** call online-only (see 14.9) |

---

## 8. Push sync (outbox → Supabase)

### 8.1 Loop

```
push():
  reset any 'in_flight' ops to 'pending' (crash recovery) — at startup only
  while online:
    op = first op where status='pending' and nextAttemptAt <= now, ordered by seq
    if none: break
    mark in_flight
    try  apply(op)  →  on success, in ONE local transaction:
                          delete op; if no other op for entity → clear row.pending; store returned remoteUpdatedAt
    catch → classify (8.3)
```

Process **strict FIFO** (dependencies like category-before-expense, payee-before-person-transfer, budget-before-allocations are satisfied by creation order). Concurrency = 1 request at a time (simple, deterministic); batch only where atomicity is required (own-account transfers) or for throughput on large backlogs *within the same entity type and consecutive seq*.

### 8.2 Applying an op

```dart
Future<String?> apply(OutboxOp op) async {
  switch (op.op) {
    case 'upsert':
      final res = await supabase.from(op.entity)
          .upsert(jsonDecode(op.payload), onConflict: op.entity == 'reminder_preferences' ? 'user_id,reminder_type'
                                          : op.entity == 'budget_allocations' ? 'daily_budget_id,category_id' : 'id')
          .select('updated_at');                      // server-assigned cursor value
      return res.first['updated_at'] as String;
    case 'delete':
      await supabase.from(op.entity).delete().eq('id', op.entityId); // 0 rows == already gone == success
      return null;
    case 'upload_proof':  /* 13 */ 
    case 'delete_proof':  /* 13 */
  }
}
```

Never send server-owned columns you don't control (`updated_at`, `created_at`). Never change `original_limit`/`original_amount` on update.

### 8.3 Failure classification (decides retry vs. park)

| Failure | Examples | Action |
|---|---|---|
| **Transient** | no network, `SocketException`, `TimeoutException`, HTTP 5xx, 429, `AuthRetryableFetchException`, 408 | keep op `pending`; exponential backoff with jitter (2s → 5m cap); stop the loop on "offline" |
| **Auth** | JWT expired (`PGRST301`/401) | refresh session once; if refresh fails because offline → treat as transient; if refresh token invalid → pause sync, show "Sign in again" **without wiping local data** |
| **Unique violation `23505`** | `(user_id, budget_date)`, `lower(name)` payee | run the resolver (8.6), then retry |
| **Permanent** | `23503` FK, `23514` CHECK, `22P02`, RLS `42501`, 4xx validation | mark op `failed` with `last_error`; mark later ops that reference the same entity `blocked`; **continue with unrelated ops**; surface in "Needs attention" (section 18) |

Never drop a user's data silently. Failed ops stay visible with: **Retry**, **Edit**, **Discard** (discard also reverts the local row to its last synced version or removes it).

### 8.4 Ordering across tables on first push

FIFO already guarantees it. For the bootstrap/restore path use dependency order: accounts, categories, payees → daily_budgets → budget_allocations, budget_templates, planned_expenses → transactions → reminder_preferences.

### 8.5 Own-account transfers

Do **not** call `create_transfer` (needs a round trip and isn't idempotent). Client generates `groupId`, builds the two rows (`type:'transfer'`, `transfer_direction:'out'/'in'`, same `transfer_group_id`, same `amount`/`occurred_at`/`note`, `category_id`/`payee_id` null) and pushes **one** `upsert([outRow, inRow])`. Deleting the transfer deletes both ids. Never allow editing a single leg.

### 8.6 Unique-constraint resolvers (the only id remapping)

- **Payee name collision** (`23505` on `payees_user_name_idx`): another device created the same person. Fetch the server payee by name, **remap** local `payees.id` → server id everywhere (`transactions.payee_id` locally and in every pending outbox payload), delete the duplicate local row, drop the failed op, retry the rest. Do the remap in one local transaction.
- **Budget date collision** (`23505` on `(user_id, budget_date)`): another device already planned that day. Fetch the server budget; adopt its id locally; remap `budget_allocations.daily_budget_id` (local + outbox); keep the server's `original_limit`; re-send the user's current values as an update (local intent wins; log to `ConflictLog`).
- Account/category: no DB uniqueness on names, so duplicates are allowed server-side (the UI warns on duplicate active names, like the web app).

### 8.7 Large backlogs

After weeks offline there may be thousands of ops. Coalesce (7), then push in chunks; show progress ("Syncing 120 of 1,840"); keep UI responsive (run sync work in an isolate or at least yield between ops); make the whole loop cancellable.

---

## 9. Pull sync (Supabase → device)

### 9.1 Cursors and keyset pagination

Per table keep `(updatedAt, lastId)` exactly as returned by the server. Page with a keyset, **not** offset, and order by `updated_at, id`:

```dart
final rows = await supabase.from(entity).select()
  .or('updated_at.gt.$cursor,and(updated_at.eq.$cursor,id.gt.$lastId)')
  .order('updated_at').order('id')
  .limit(1000);                         // PostgREST page cap
```

Apply the whole page and advance the cursor **in one local transaction**. If the app dies mid-pull it resumes from the stored cursor.

### 9.2 Clock/commit-order safety

`updated_at` is assigned at transaction time, so a long transaction can commit *after* a later cursor was read. Mitigation: **overlap window** — start each pull at `cursor − 2 minutes` (compare as timestamptz), and make apply **idempotent** (upsert by id). Never use the device clock for cursors.

### 9.3 Applying remote rows

For each pulled row (inside the local transaction):

```
local = rows[id]
if local == null                         → insert (pending=false, remoteUpdatedAt=row.updated_at)
else if no pending outbox op for id      → overwrite with server row
else (local has pending changes)         → keep local row; record remoteUpdatedAt as "seen";
                                           if server.updated_at != op.baseUpdatedAt → conflict (10)
```

### 9.4 Deletions

After rows, pull `sync_tombstones where deleted_at > cursor` (same keyset idea on `(deleted_at,id)`), filtered to the user by RLS. Apply: delete the local row **unless** it has a pending local upsert (then: local edit wins → re-upsert, see 10). Deleting a `daily_budgets` row also removes its local allocations (mirror the cascade).

### 9.5 Bootstrap and re-bootstrap

- **First sign-in on a device (must be online):** pull every table fully (dependency order), show a progress screen, then enter the app. If offline at first sign-in, explain that the first sync needs a connection.
- **Re-bootstrap** when: tombstone retention was exceeded (`last successful sync` older than retention), local DB corrupted/key lost, or user taps "Rebuild from server". Rule: only wipe+rebuild when the **outbox is empty**; otherwise export the pending ops (JSON) and make the user choose.

### 9.6 Realtime (optional accelerator)

Subscribe (`supabase.channel(...).onPostgresChanges`) while the app is foregrounded to trigger an immediate **delta pull** — treat the event as a hint only; always pull through the normal cursor path so correctness doesn't depend on websocket delivery.

---

## 10. Conflict policy

The app is single-user, multi-device; true conflicts are rare. Policy goals: **no silent data loss**, simple and predictable.

| Situation | Resolution |
|---|---|
| Same row edited locally (pending) and remotely | **Local edit wins** (it's the more recent *user intent* to be applied). Push overwrites. The overwritten server version is stored in `ConflictLog` (viewable, restorable). Detect via `baseUpdatedAt != server.updated_at` returned/observed before push. |
| Local delete (pending) vs remote edit | **Delete wins** (explicit intent). Log it. |
| Remote delete vs local pending edit | **Edit wins** → row is re-created on push. Log it. |
| Both created "the same" thing (payee name, budget date) | Resolvers in 8.6 (merge into the server record). |
| Daily budget `original_*` | Server value always wins (immutable); client never changes it. |
| Transfers (2 legs) | Treated as a unit: create/delete together; never merged leg-by-leg. |
| Money-affecting edits to a *closed* day | Allowed (same as web); not a conflict. |

Because balances/reports are derived from rows, once rows converge every device shows identical numbers.

---

## 11. Sync orchestration

**Single-flight:** one `SyncEngine` instance with a mutex; concurrent triggers coalesce into "run again after this pass".

**Triggers:** after every local write (debounced ~1 s); app start/resume; connectivity restored; manual pull-to-refresh; periodic timer while foregrounded (e.g. every 5 min); realtime hint; background task.

**Order of a pass:** push outbox → pull deltas → push again if new local changes appeared.

**Connectivity:** `connectivity_plus` only tells you an interface is up. Confirm reachability with a lightweight request to the Supabase REST URL (HEAD/GET with 4 s timeout) before a pass; treat failures as "offline", not errors.

**Background sync:** `workmanager` (Android periodic ≥15 min, constraint: network connected) and iOS `BGAppRefreshTask`/silent best-effort. Background isolate must initialise its own Drift connection (same encrypted file, key from secure storage) and Supabase session. Don't promise timing on iOS; foreground sync is the guarantee.

**Status model exposed to UI** (`Stream<SyncStatus>`): `offline`, `idle(lastSyncedAt)`, `syncing(done,total)`, `pending(n)`, `attention(n failed)`, `authRequired`, `updateRequired`.

---

## 12. Authentication and device security

1. **Sign-in needs a network once.** Persist the Supabase session using a `LocalStorage` implementation backed by `flutter_secure_storage` (not plain SharedPreferences).
2. **Offline is fine with an expired access token:** the app works from local data; **never sign the user out because a refresh failed offline.** Refresh on reconnect; only if the server says the refresh token is invalid/revoked → show "Sign in again" and keep local data + outbox until they re-authenticate **as the same user** (if a different user signs in, require an explicit "export/discard pending changes" step first).
3. **Sign-out with unsynced changes:** warn with the pending count; offer "Sync now", "Export pending (JSON/CSV)", or "Sign out and discard". Default action = don't lose data.
4. **App lock:** optional biometric/PIN (`local_auth`) on launch and after N minutes in background; blur the app-switcher snapshot; optionally block screenshots (`FLAG_SECURE`) in Settings → Privacy.
5. **At-rest encryption:** SQLCipher DB + app-private proof files (don't write proofs to the gallery). Clear temp files after upload.
6. **Secrets:** only `SUPABASE_URL` and the publishable key in the app (via `--dart-define`). Never a service-role key, DB password, or `.env` committed.
7. **Account deletion:** the web app uses a server action with the service-role key — impossible in-app. Provide a Supabase **Edge Function** `delete-account` (verifies the caller's JWT, deletes that user with the service role; all rows cascade). The app calls it (online only), then wipes local data. "Delete my transactions & plans" is a normal data operation (14.9).
8. **Email links:** register the deep link for confirm/reset; handle `supabase.auth.onAuthStateChange` for `passwordRecovery`.

---

## 13. Proof images (offline-capable)

Goal: attach a proof offline, upload later, never leave dangling references.

1. User picks/captures an image (`image_picker`). **Compress** (`flutter_image_compress`: longest side 1600 px, JPEG q≈80) and enforce **≤ 4 MB** and jpeg/png/webp (same as web).
2. Copy to app-private storage (`<docs>/proofs/<uuid>.jpg`). Generate the **final storage path now**: `<userId>/<uuid>.jpg`.
3. Write the transaction row with `receipt_path = <that path>` (and `receiptLocalFile` locally) and enqueue, **in this order**: `upload_proof` → `upsert transaction`. (If the row went first, the web app could briefly show a proof that doesn't exist.)
4. `upload_proof` op: `storage.from('receipts').uploadBinary(path, bytes, fileOptions: FileOptions(contentType:'image/jpeg', upsert:false))`. Treat "already exists" (409/Duplicate) as success (a previous attempt succeeded). On success clear `receiptLocalFile`; keep a local thumbnail cache.
5. **Replace/remove proof:** queue `delete_proof` for the *old* path **after** the row update succeeds. If the proof was never uploaded, just delete the local file and cancel its queued upload.
6. **Delete transaction** with a proof: queue `delete_proof` after the row delete (best-effort; failures don't block).
7. **Viewing:** local file if present; otherwise request a signed URL (120 s) when online and cache the downloaded bytes encrypted/app-private; offline + not cached → show a placeholder "Proof available when online".
8. Permanent upload failure (too large, wrong type): clear `receipt_path` on the row, enqueue the row update, tell the user.
9. Orphan cleanup: on startup, delete local proof files not referenced by any row/op older than 24 h.

---

## 14. Screens: required behaviour (online *and* offline)

General: every screen reads from Drift streams; **no screen shows a spinner waiting for the network**. Empty/loading/error states per the web brief. Phone-first, usable on tablets (two-pane where it helps).

1. **Dashboard:** balance (derived), "Left for today" hero with progress and status (none/ok/approaching/over; threshold from `budget_threshold` reminder pref), planned/spent/unplanned, month income/expenses/net, "Sent to people this month (not in spending)", today by category, last-7-days chart, recent transactions. Sync chip in the header.
2. **Plan Today:** day switcher, limit + allocations with live "allocated / not allocated", over-limit validation, copy yesterday / template, save (as template), planned expenses, day review + close/reopen, "was X" hints from `original_*`.
3. **Add sheet (bottom sheet):** Expense / Income / Transfer (sub-choice: *With a person* | *My accounts*). Amount-first numeric keypad, category chips, planned/unplanned, account, date-time (in profile timezone), merchant/note. Optimistic save; stays open offline exactly as online.
4. **Transactions:** search, date range, category, account, planned filter; date-grouped list; edit/duplicate/delete with confirm; proof button; pending badge. Query is local SQL (fast, offline).
5. **Transfers (people):** period presets (incl. all-time), person filter, summary (sent, received, net sent, count/with proof), per-person cards with all-time totals, history, CSV export, "Send / receive" action. Person input with suggestion chips; "I sent / I received". These rows change balances but are **not** expenses/income and **do not** reduce "Left for today".
6. **Reports:** presets + custom range, filters, summary cards (opening, income, expenses, net, closing), unplanned callout, people-transfer note, donut, trend (daily/weekly), planned vs actual, comparison, payment methods, top merchants; chart text summaries for accessibility; CSV export via share sheet. All computed locally from Drift.
7. **Settings:** profile (name/currency/timezone), accounts (add/rename/archive, opening balance), categories (add/archive, colour), reminders & alerts, data & security (export, app lock, sign out), danger zone.
8. **Sync & diagnostics screen:** status, last synced, pending count, **Needs attention** list (failed/blocked ops with Retry/Edit/Discard), conflict log, "Sync now", "Rebuild from server" (guarded), export pending ops, app/schema versions.
9. **Online-only actions** (disable with a clear message when offline): sign-up/sign-in/reset first time, account deletion, "Rebuild from server". "Delete all my transactions & plans": allow offline by queueing per-row deletes (show progress), or require online and do it in one server call — pick one and document it; default: online-only with confirm.

Timezone changes: recompute day grouping on the fly (it's derived); do not rewrite stored instants.

---

## 15. Reminders and alerts (local, offline)

- `flutter_local_notifications` + timezone-aware scheduling (`zonedSchedule`, `matchDateTimeComponents: time`) for the **plan_day** and **close_day** reminders using `reminder_time` in the profile timezone. Reschedule when preferences or timezone change, and after reboot.
- **Budget threshold alert:** after a local expense write, run `summarizeDay` for that day; if the status crosses the configured threshold (75/90/100 — same `spent*100 >= warn*limit` rule) and hasn't alerted for that level today, post one notification. Store "alerted level per date" locally to avoid spam.
- Respect OS notification permission (request lazily with an explanation); every reminder individually switchable (same prefs table as web).

---

## 16. UI/UX and design system

Follow the web brief §9, §20, §25, expressed in Flutter:

- **Tokens** mirroring `src/app/globals.css`: calm warm-neutral background, deep-teal primary (`oklch(0.44 0.09 195)` ≈ `#0F5F66`), semantic success/warning/destructive, chart palette 1–8, radius 8, spacing scale 4/8/12/16/24; light + dark `ThemeData` from one token file. Status vocabulary: **Planned · Spent · Unplanned · Left for today · Over budget**. Color is never the only cue (icons, text, ± signs).
- **Fonts:** Inter (400/500/600/700) + Noto Sans Bengali **bundled as assets** (never fetched at runtime — must work offline). Tabular figures (`FontFeature.tabularFigures()`) for all money. Verify ৳, negatives, large amounts, mixed Bangla/English.
- **Tap targets ≥ 48 dp**, safe-area aware bottom navigation, large "Add Expense" FAB, keyboard-aware bottom sheets, landscape + tablet layouts, text scaling to 200%, `Semantics` labels, chart text summaries, reduced-motion respected (`MediaQuery.disableAnimations`).
- **Sync UX:** small status chip (offline / syncing / "3 pending" / "needs attention"); per-row pending dot; never block actions; success toasts only for explicit user actions, not for background sync.
- **Motion:** minimal (sheet slide, tab fade, button press feedback). No decorative animation.

---

## 17. Testing strategy

| Layer | What | How |
|---|---|---|
| Domain | Money, dates/timezones (Dhaka UTC+6, New_York DST 23h/25h days, leap years, month/year edges), budget status, transfers, person transfers, reports, tracker, CSV | `test/` pure Dart + **parity fixtures** from the web tests (section 5) |
| Local DB | DAOs, filters/search, migrations, outbox coalescing | Drift in-memory DB; `drift_dev` schema tests |
| Sync engine | push/pull/conflicts against a **FakeRemote** (in-memory server that implements upsert/delete/updated_at/tombstones/RLS-like rejection and can inject faults) | unit tests, deterministic clock |
| Integration | real Supabase (`supabase start` local stack with all migrations + sync migration) | `integration_test` + two simulated devices |
| UI | key flows, golden tests at 360×800, 390×844, 430×932, 768×1024; light/dark; large text | `flutter_test` goldens |
| Security | RLS with two users (reuse the web `rls.test.ts` expectations via REST), no secrets in build, DB file is encrypted | scripts/CI |

**Sync scenario matrix (all must pass):**

1. Create expense offline → app killed → relaunch → still there, pending → go online → pushed once (no duplicate after retry/timeouts).
2. 500 offline writes across all entity types → reconnect → all arrive, FK order respected, UI never freezes.
3. Edit the same transaction on two devices (one offline) → local wins, other device converges, `ConflictLog` has the overwritten version.
4. Delete on device A, edit on device B (pending) → edit wins and row reappears on A.
5. Two devices create the same payee name / plan the same date offline → merged by resolvers; no duplicate payee; allocations re-pointed.
6. Server rejects one op permanently (CHECK/RLS) → op parked as failed; unrelated ops continue; dependents blocked; user can Edit/Discard.
7. Token expires during a long offline period → app fully usable → reconnect → silent refresh → push succeeds; refresh-token revoked → "Sign in again", data preserved.
8. Pull interrupted mid-page (kill app) → resumes from cursor; no gaps; overlap window leaves no missed rows.
9. Device offline longer than tombstone retention → forced safe re-bootstrap (only when outbox empty; otherwise guided export).
10. Proof attached offline → uploaded before the row; upload retried after failure; "already exists" treated as success; replacing/deleting removes the old object; orphans cleaned.
11. Own-account transfer offline → both legs pushed atomically; deleting removes both on all devices; person transfers never alter expense totals.
12. Timezone changed in Settings on one device → other device regroups days correctly after profile sync; instants unchanged.
13. Clock skew (device clock ±1 day) → no effect on cursors/ordering; `occurred_at` honours what the user picked.
14. Flapping connectivity (toggle airplane mode every few seconds during sync) → no corruption, no stuck `in_flight`.
15. Schema/app version too old → "Update required", offline use continues, outbox preserved.

Coverage targets: domain ≥ 95 %, sync engine ≥ 90 % branches (every row of 8.3 and 10 has a test).

---

## 18. Observability and support tooling

- Structured local log ring buffer (last ~2,000 lines: sync passes, op outcomes, classified errors — **no amounts, names or notes**), exportable from the diagnostics screen.
- Optional crash/error reporting (Sentry) with PII scrubbing; never attach row data.
- Diagnostics screen (14.8) is the support tool: pending/failed counts, oldest pending op age, last successful push/pull per table, cursors, versions.
- Metrics worth tracking locally: time-to-first-sync, push throughput, conflicts per week, failed-op rate.

---

## 19. Build, release, compatibility

- Flavors: `dev` (local Supabase or a test project), `prod`. `--dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=…`; a CI check fails if a service-role key pattern appears in the repo or build.
- CI: `flutter analyze`, format check, unit/db/sync tests, parity fixtures, goldens, build APK/AAB and iOS archive; optional integration tests against `supabase start`.
- Android: min SDK per `sqlcipher_flutter_libs`/`workmanager` requirements; permissions: notifications, camera (proofs), exact alarms **not** required (use inexact scheduled notifications unless users demand precision). iOS: Face ID usage string, camera/photo usage strings, background modes (`fetch`).
- **Compatibility contract with the backend:** every backend migration that changes tables used by the app must be backward compatible for at least two app releases (add columns nullable/with defaults; don't rename/drop). Bump `app_config.min_client_version` only when a breaking change is unavoidable.
- Versioning: semver; local DB schema version independent; sync protocol version recorded in `app_config`.

---

## 20. Delivery plan (phases with acceptance criteria)

**Phase 0 — Backend sync support.** Apply appendix A; verify with SQL: update bumps `updated_at`; delete writes a tombstone; cascaded deletes write tombstones; `original_*` immutable. *Done when* a script can pull "everything since T" and "deletions since T" for a user and RLS hides other users' rows.

**Phase 1 — Foundation.** Project, theme/tokens, bundled fonts, DI, Drift + SQLCipher, auth (secure session storage), domain ports of money/dates/results with **parity tests green**. *Done when* parity fixtures for money/dates pass and a user can sign in and see their profile offline after first login.

**Phase 2 — Local-first core (no sync yet).** Accounts, categories, transactions, budgets, calculators, dashboard, plan, add sheet, history, reports, settings — all against Drift only. *Done when* the app works end-to-end in airplane mode and reports match web fixtures.

**Phase 3 — Sync engine.** Outbox + coalescing, push with classification/backoff, pull with keyset cursors/tombstones/overlap, bootstrap, resolvers, conflict log, status stream, diagnostics screen. *Done when* scenarios 1–9, 11, 13–15 pass against the FakeRemote **and** against a local Supabase stack.

**Phase 4 — People transfers + proofs.** Payees, person-transfer form, tracker screen, proof capture/compress/queue/upload/view/cleanup. *Done when* scenario 10 passes and the tracker matches web totals for the same data.

**Phase 5 — Notifications, security, polish.** Local reminders + threshold alerts, app lock, privacy options, account-deletion Edge Function, CSV export/share, accessibility and tablet/landscape polish, performance pass (10k transactions: dashboard < 200 ms, list scroll 60 fps, cold start < 2 s). *Done when* section 16 and 17 checklists pass on real devices (low-end Android + iPhone).

**Phase 6 — Beta & hardening.** Real-device soak (offline for days, flapping networks), dogfood with the live Supabase project, fix findings, store assets/privacy policy (financial data handling, no bank credentials).

---

## 21. Edge-case checklist (review before release)

- [ ] All money in `int` minor units; no `double` anywhere in persistence or domain.
- [ ] Late-night transaction lands on the correct local day; timezone switch regroups without rewriting data.
- [ ] A transfer/person-transfer is never counted as income/expense/"spent today"; both legs of own-account transfers always travel together.
- [ ] Editing a plan keeps `original_*`; categories/accounts/payees are archived, not deleted.
- [ ] Every outbox payload satisfies the server CHECK shape and includes `user_id`.
- [ ] No op is ever dropped silently; every failure is visible and actionable.
- [ ] `in_flight` ops are reset after a crash; sync is single-flight.
- [ ] Pull is idempotent, keyset-paginated, with an overlap window; cursors advance atomically with applied rows.
- [ ] Sign-out/Re-bootstrap never discards a non-empty outbox without explicit consent.
- [ ] Offline access token expiry never logs the user out; revoked refresh token preserves local data.
- [ ] Proof: upload-before-row ordering, "already exists" = success, old object removed, orphans cleaned, no gallery writes.
- [ ] Fonts bundled; app launches and works with no network at all (after first sign-in).
- [ ] No secrets in repo/build; only publishable key; Edge Function for account deletion.
- [ ] Notifications rescheduled after timezone/preference change and device reboot.
- [ ] CSV export matches the web format (header, signed amounts, injection guard, BOM).

---

## Appendix A — Backend "sync support" migration (new file, run once)

Save as `supabase/migrations/<timestamp>_sync_support.sql`. Review before applying; test on a copy first.

```sql
-- 1) updated_at everywhere (tables that already have it are skipped by IF NOT EXISTS)
alter table public.accounts            add column if not exists updated_at timestamptz not null default now();
alter table public.categories          add column if not exists updated_at timestamptz not null default now();
alter table public.payees              add column if not exists updated_at timestamptz not null default now();
alter table public.budget_allocations  add column if not exists updated_at timestamptz not null default now();
alter table public.planned_expenses    add column if not exists updated_at timestamptz not null default now();
alter table public.reminder_preferences add column if not exists updated_at timestamptz not null default now();
-- profiles, daily_budgets, budget_templates, transactions already have updated_at.

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','payees','budget_allocations','planned_expenses','reminder_preferences',
                           'budget_templates']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_set_updated', t);
  end loop;
  -- delta-pull index on every synced table
  foreach t in array array['accounts','categories','payees','daily_budgets','budget_allocations','budget_templates',
                           'planned_expenses','transactions','reminder_preferences']
  loop
    execute format('create index if not exists %I on public.%I (user_id, updated_at, id)', t || '_sync_idx', t);
  end loop;
end $$;

-- 2) tombstones for hard deletes
create table if not exists public.sync_tombstones (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  table_name text not null,
  row_id uuid not null,
  deleted_at timestamptz not null default clock_timestamp()
);
create index if not exists sync_tombstones_user_idx on public.sync_tombstones (user_id, deleted_at, id);
alter table public.sync_tombstones enable row level security;
create policy sync_tombstones_select on public.sync_tombstones
  for select to authenticated using (user_id = (select auth.uid()));
-- no insert/update/delete policies: only the trigger below (security definer) writes.

create or replace function public.record_tombstone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sync_tombstones (user_id, table_name, row_id) values (old.user_id, tg_table_name, old.id);
  return old;
end $$;
revoke all on function public.record_tombstone() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','payees','daily_budgets','budget_allocations','budget_templates',
                           'planned_expenses','transactions','reminder_preferences']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_tombstone', t);
    execute format('create trigger %I after delete on public.%I for each row execute function public.record_tombstone()',
                   t || '_tombstone', t);
  end loop;
end $$;

-- 3) original_* are immutable after insert
create or replace function public.keep_original_limit() returns trigger
language plpgsql set search_path = '' as $$
begin new.original_limit := old.original_limit; return new; end $$;
create or replace function public.keep_original_amount() returns trigger
language plpgsql set search_path = '' as $$
begin new.original_amount := old.original_amount; return new; end $$;

drop trigger if exists daily_budgets_keep_original on public.daily_budgets;
create trigger daily_budgets_keep_original before update on public.daily_budgets
  for each row execute function public.keep_original_limit();
drop trigger if exists budget_allocations_keep_original on public.budget_allocations;
create trigger budget_allocations_keep_original before update on public.budget_allocations
  for each row execute function public.keep_original_amount();

-- 4) client compatibility gate (read-only for clients)
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  schema_version int not null default 1,
  min_client_version text not null default '0.0.0'
);
insert into public.app_config (id) values (1) on conflict do nothing;
alter table public.app_config enable row level security;
create policy app_config_read on public.app_config for select to authenticated using (true);

-- 5) optional: live updates
-- alter publication supabase_realtime add table public.transactions, public.accounts, public.categories,
--   public.payees, public.daily_budgets, public.budget_allocations, public.planned_expenses;
```

Caveats: tombstones are recorded **per row**, including rows removed by `on delete cascade`; tombstones are not written when a whole auth user is deleted (irrelevant — the account is gone). Purge tombstones older than your retention (e.g. 90 days) with a scheduled job (`pg_cron`) and expose that retention to the client (`app_config`).

## Appendix B — Push-loop skeleton

```dart
class PushEngine {
  PushEngine(this.db, this.remote, this.clock);
  Future<void> run() async {
    while (await remote.isReachable()) {
      final op = await db.outbox.nextReady(clock.nowMs());
      if (op == null) return;
      await db.outbox.markInFlight(op.seq);
      try {
        final remoteUpdatedAt = await remote.apply(op);
        await db.transaction(() async {
          await db.outbox.remove(op.seq);
          await db.rows.markSynced(op.entity, op.entityId, remoteUpdatedAt: remoteUpdatedAt);
        });
      } on RemoteFailure catch (f) {
        switch (f.kind) {
          case FailureKind.transient:
            await db.outbox.backoff(op.seq, f.message, clock.nowMs());
            if (f.isOffline) return;            // stop; resume on connectivity
          case FailureKind.auth:
            if (!await remote.refreshSession()) { await db.outbox.release(op.seq); return; }
          case FailureKind.unique:
            await resolvers.resolve(op, f);      // 8.6, then loop retries
          case FailureKind.permanent:
            await db.outbox.park(op.seq, f.message);   // failed + block dependents; continue with others
        }
      }
    }
  }
}
```

## Appendix C — Server ⇄ local field mapping (quick reference)

| Server column | Local column | Conversion |
|---|---|---|
| `id` | `id` | UUID string (client-generated) |
| `updated_at` | `remoteUpdatedAt` | keep raw string |
| `amount`, `opening_balance`, `total_limit`, `planned_amount`, … (bigint) | `INTEGER` | as is (minor units) |
| `occurred_at` (timestamptz) | `occurredAtMs` | parse → UTC epoch ms; send `toUtc().toIso8601String()` |
| `budget_date`, `planned_date` (date) | `TEXT` | `YYYY-MM-DD` |
| `transfer_direction`, `type`, `planned_status`, `status` | `TEXT` | validate against allowed values when mapping |
| `allocations` (jsonb on `budget_templates`) | JSON text | `[{categoryId, amount}]` |
| `reminder_time` (time) | `TEXT 'HH:mm'` | server returns `HH:mm:ss` → trim |
| `receipt_path` | `receiptPath` | `<userId>/<uuid>.<ext>` |
