PERSONAL FINANCE TRACKER

# Web Application --- Product Requirements & Agent Handover

A practical system for daily money planning, expense capture, and clear
spending insights

  -----------------------------------------------------------------------
  Document type                       Product requirements /
                                      implementation brief
  ----------------------------------- -----------------------------------
  Primary user                        Single user managing personal
                                      income and expenses

  Default currency & locale           BDT (৳), Asia/Dhaka; user can
                                      change currency and timezone
  -----------------------------------------------------------------------

## 1. Product vision

Build a responsive personal finance web application that helps the user
decide how money should be used before spending it, record every
transaction with minimal effort, and understand exactly where money went
at the end of a day, week, month, or custom cycle. The experience should
reduce unplanned purchases and make spending patterns easy to understand
through simple visual reports.

## 2. Main outcomes

-   Know the available balance and the amount that can safely be spent
    today.
-   Create a realistic daily spending plan before the day begins.
-   Record planned and unplanned expenses as soon as they happen.
-   See planned-versus-actual spending and identify overspending early.
-   Review clear charts and summaries at the end of a selected cycle.
-   Build a searchable history so no cash, card, or mobile-wallet
    expense is forgotten. \## 3. Target platform and scope

Deliver a mobile-first, responsive web application that also works
comfortably on desktop. A Progressive Web App (PWA) installable
experience is preferred.

### MVP --- must have

-   Secure user sign-in and private user data.

-   Dashboard with balance, today's budget, today's spending, and
    remaining amount.

-   Daily budget planning with category allocations.

-   Fast manual income and expense entry.

-   Categories, payment methods/accounts, transaction history, and
    search/filter.

-   Daily close-out and weekly/monthly/custom-period reports.

-   Charts for category split, spending trend, planned vs actual, and
    payment method.

-   Export transactions and reports to CSV. \### Out of scope for first
    release

-   Automatic bank, card, or mobile-wallet transaction syncing.

-   Investment portfolio, lending, tax filing, or accounting features.

-   Multi-user household sharing and complex permission roles.

-   AI financial advice or automatic movement of money. \## 4. Core user
    journey

1.  Set up the app: choose currency, opening balance, income sources,
    spending categories, and payment methods.
2.  At the start of a day: enter expected income if applicable, set a
    daily spending limit, and allocate amounts to categories.
3.  During the day: add each expense using a quick-entry form; choose
    amount, category, payment method, and optional note.
4.  If an expense was not planned: allow it to be saved as "Unplanned"
    and show its impact on the remaining daily budget.
5.  At day end: review planned amount, actual amount, unplanned amount,
    remaining amount, and any over-budget categories.
6.  At the end of a week/month/custom cycle: review charts, compare
    periods, identify top spending categories, and export the report.
    \## 5. Functional requirements

### 5.1 Dashboard

-   Show current available balance, total income this period, total
    expenses this period, and net cash flow.

-   Show today's planned budget, amount spent, remaining budget, and
    percentage used.

-   Display a clear status when the user is approaching or has exceeded
    the daily limit.

-   Provide a prominent "Add Expense" action and a secondary "Add
    Income" action.

-   Show recent transactions and a compact category spending summary.
    \### 5.2 Daily planning and budgets

-   Allow a total daily spending limit and optional category-level
    limits (e.g., food, transport, groceries, personal, bills,
    entertainment, health, other).

-   Allow users to copy yesterday's plan or use a saved daily template.

-   Allow a planned expense to include an expected amount, category,
    date, and optional description.

-   Allow a user to change a plan during the day while preserving the
    original planned amount for comparison.

-   Do not treat budget allocations as actual expenses; only a recorded
    transaction changes actual spending.

-   Support no-spend days and days with no daily budget. \### 5.3
    Transaction capture

-   Expense fields: amount, date/time, category, payment method/account,
    planned or unplanned status, optional merchant/title, notes, and
    optional receipt image.

-   Income fields: amount, date/time, source/category, destination
    account, and optional note.

-   Support cash, bank account, debit/credit card, mobile financial
    service, and custom payment methods.

-   Allow edit, delete, duplicate, and search transactions; show a
    confirmation before destructive actions.

-   Use a fast-entry flow that can be completed in a few taps on a
    phone.

-   Store transaction timestamps consistently and display them in the
    user's selected timezone. \### 5.4 Categories and accounts

-   Provide editable default categories and allow custom categories with
    names and optional icons/colors.

-   Allow category archiving without deleting historical transactions.

-   Allow multiple cash/bank/wallet accounts and transfers between the
    user's own accounts.

-   Transfers must not be counted as income or expense in spending
    reports; they only move money between accounts.

-   Prevent accidental duplicate counting when recording a transfer.
    \### 5.5 Reports and visual analytics

-   Daily report: planned vs actual, planned expenses completed,
    unplanned expenses, remaining budget, and category breakdown.

-   Period summary: opening balance, income, expenses, transfers
    excluded, net cash flow, and closing balance.

-   Donut/pie chart: expenses by category.

-   Bar chart: spending by day or week across the selected period.

-   Comparison chart: planned budget vs actual spending by category.

-   Payment-method breakdown and top merchants/expense descriptions.

-   Period-over-period comparison (e.g., this month vs previous month)
    with amount and percentage change.

-   Filters for date range, category, account/payment method, and
    planned/unplanned status.

-   Charts must include readable labels, exact amounts, and accessible
    legends; never rely on color alone. \### 5.6 Reminders and spending
    alerts

-   Optional daily reminder to create a plan and optional evening
    reminder to close the day.

-   Optional alert when 75%, 90%, or 100% of the daily/category budget
    is used; thresholds should be configurable.

-   Avoid excessive notifications; users must be able to turn each
    reminder/alert off. \## 6. Key screens

  -----------------------------------------------------------------------
  Screen                              Required contents
  ----------------------------------- -----------------------------------
  Dashboard                           Balance cards, today's budget
                                      progress, quick actions, recent
                                      transactions, and a small spending
                                      chart.

  Plan Today                          Daily limit, category allocations,
                                      planned items, copy-previous-plan
                                      action, and save plan.

  Add Transaction                     Fast expense/income form with
                                      amount first, category, date/time,
                                      payment method, and optional
                                      details.

  Transactions                        Searchable/filterable list with
                                      edit/delete and planned/unplanned
                                      indicators.

  Reports                             Date-range selector, summary cards,
                                      category chart, daily trend,
                                      planned-vs-actual chart, and
                                      export.

  Settings                            Currency, timezone, categories,
                                      accounts/payment methods,
                                      reminders, data export, and account
                                      security.
  -----------------------------------------------------------------------

## 7. Data model (suggested)

  -----------------------------------------------------------------------
  Entity                              Suggested fields
  ----------------------------------- -----------------------------------
  User                                id, name, email, password/auth
                                      provider, currency, timezone,
                                      createdAt

  Account                             id, userId, name, type,
                                      openingBalance, currentBalance,
                                      isArchived

  Category                            id, userId, name, icon, color, type
                                      (income/expense), isDefault,
                                      isArchived

  DailyBudget                         id, userId, date, totalLimit,
                                      originalLimit, notes

  BudgetAllocation                    id, dailyBudgetId, categoryId,
                                      plannedAmount

  PlannedExpense                      id, userId, date, categoryId,
                                      title, expectedAmount, status

  Transaction                         id, userId, accountId, categoryId,
                                      type (income/expense/transfer),
                                      amount, dateTime, merchant, note,
                                      plannedStatus, receiptUrl,
                                      transferGroupId

  ReminderPreference                  id, userId, reminderType, enabled,
                                      time, thresholdPercent
  -----------------------------------------------------------------------

## 8. Business rules and calculations

-   Actual expenses for a date = sum of expense transactions whose local
    transaction date matches that date.

-   Actual income for a date = sum of income transactions for that local
    date.

-   Daily remaining budget = daily spending limit − actual expenses. It
    may be negative when overspent.

-   Category remaining = category allocation − actual expenses in that
    category.

-   Unplanned spending = expenses marked unplanned; show separately but
    include them in total actual expenses.

-   Period net cash flow = income − expenses. Internal transfers are
    excluded.

-   Closing balance = opening balance + income − expenses, adjusted for
    opening/closing balance changes and excluding internal transfers.

-   Do not silently change historical budget values when a user edits a
    plan; retain original plan and current plan for accurate variance
    reporting.

-   Use decimal-safe monetary storage (e.g., integer minor units or
    fixed-precision decimal), never binary floating-point for persisted
    money. \## 9. UX and visual design direction

-   Clean, calm, modern personal-finance dashboard; avoid a cluttered
    accounting-software appearance.

-   Mobile-first layout with large tap targets and a very fast
    expense-entry flow.

-   Use clear typography, generous spacing, consistent icons, and
    restrained status colors.

-   Make the remaining daily budget the most prominent daily metric.

-   Use plain language: "Planned", "Spent", "Unplanned", "Left for
    today", and "Over budget".

-   Charts should be understandable at a glance and include tooltips or
    exact values.

-   Provide empty states with a clear next action, plus loading, error,
    and success states. \## 10. Technical and non-functional
    requirements

-   Use a maintainable, modular architecture with clear separation
    between UI, business logic, and data access.

-   Suggested stack: Next.js + React + TypeScript frontend; Supabase for
    PostgreSQL database, Authentication, Row Level Security (RLS), and
    optional Storage for receipt images; Recharts or Chart.js for
    analytics. Use Supabase client libraries from the frontend only with
    the publishable/anon key and RLS enabled. Any service-role key must
    remain server-side.

-   Use authenticated, user-scoped API access; every record must be
    isolated by userId.

-   Validate amounts, dates, categories, and account ownership on both
    client and server.

-   Encrypt traffic with HTTPS; hash passwords using a modern password
    hashing algorithm if password auth is used.

-   Do not store banking credentials or sensitive payment-card details.

-   Provide database migrations, seed/default categories,
    environment-variable examples, and setup instructions.

-   Support backup/export of user data and a clear account/data deletion
    process.

-   Design for reliable operation on current Chrome, Edge, Firefox, and
    Safari, including common mobile browsers. \## 11. Acceptance
    criteria

-   A user can create an account, sign in, and only access their own
    data.

-   A user can set a daily budget and allocate it across multiple
    categories.

-   A user can add an expense and see the dashboard totals update
    immediately.

-   An unplanned expense is visibly marked and included in actual
    spending.

-   The app correctly calculates remaining budget, including a negative
    value when overspent.

-   Transfers between owned accounts do not inflate income or expenses.

-   A user can filter transactions by date, category, account, and
    planned status.

-   A user can view daily, weekly, monthly, and custom-range reports.

-   Reports show category breakdown, spending trend, and
    planned-vs-actual comparisons.

-   CSV export contains the selected transactions and accurate
    amounts/dates.

-   The app remains usable on a phone-sized screen and has clear
    validation/error states. \## 12. Suggested delivery phases

Phase 1 --- Foundation: Project setup, authentication, database schema,
user settings, accounts, and categories.

Phase 2 --- Daily money workflow: Dashboard, daily budget planning,
quick transaction entry, transaction list, and core calculations.

Phase 3 --- Reports: Daily close-out, date filters,
category/trend/planned-vs-actual charts, and CSV export.

Phase 4 --- Quality and polish: Responsive/PWA improvements, reminders,
alerts, security review, testing, deployment, and documentation.

## 13. Agent implementation instructions

-   Read this document and propose a short implementation plan before
    coding.
-   Follow the Clean Architecture rules and feature-first folder structure in the dedicated architecture section. Treat these as mandatory acceptance criteria, not optional suggestions.
-   Implement business rules in the domain layer and access Supabase only through data-layer repository implementations; never query Supabase directly from UI components or hooks.
-   Keep domain/use-case tests independent of Next.js and Supabase, and add repository/RLS integration tests.

-   Confirm the selected stack, database schema, authentication
    approach, and deployment target.

-   Build the MVP end-to-end; do not stop after creating static UI
    screens.

-   Use realistic demo data for preview, but clearly separate demo data
    from the signed-in user's real records.

-   Add unit tests for money calculations, budget variance, transfer
    handling, and date/time boundaries.

-   Add basic integration tests for creating, editing, filtering, and
    exporting transactions.

-   Document how to run locally, configure environment variables,
    migrate/seed the database, and deploy.

-   At completion, provide a concise list of implemented features, known
    limitations, and any required setup actions. \## 14. Product
    decisions / assumptions

-   The first version is for one person's personal finances, but the
    data model should not block future multi-user support.

-   Default currency is BDT (৳) and timezone is Asia/Dhaka; both must be
    configurable.

-   Manual transaction entry is the source of truth in the MVP.
    Bank/mobile-wallet integrations can be considered later.

-   The app should not make financial decisions or move money; it is a
    planning and tracking tool.

-   The user should be able to start with a simple daily plan and
    gradually use advanced categories and reports. \## 15. Definition of
    done

The MVP is complete when the user can plan a day, record every income
and expense, distinguish planned from unplanned spending, see an
accurate remaining daily budget, review clear reports for a selected
cycle, and export their transaction history. The app must be responsive,
secure, tested for core calculations, and accompanied by
setup/deployment documentation.

## Clean Architecture and codebase structure — mandatory

The application must follow Clean Architecture consistently. Do not build it as a collection of pages that call Supabase directly. Keep business rules independent from Next.js, React, Supabase, charting libraries, and other external tools. Use a **feature-first structure with clear presentation, domain, and data layers**. Apply these principles without creating unnecessary abstractions for trivial UI elements.

### Architecture rules

1. **Dependency direction:** Presentation may depend on domain; data may depend on domain; domain must not depend on presentation, Next.js, Supabase, or infrastructure packages. Dependencies point inward toward the domain.
2. **Domain owns business rules:** Budget calculations, planned-versus-actual logic, transaction classification, transfer handling, period boundaries, and validation rules belong in domain code—not React components, route handlers, or database queries.
3. **Repository contracts live in domain:** Define repository interfaces/ports in the domain layer. Implement them in the data layer using Supabase clients and database queries.
4. **Use cases represent application actions:** Examples include `CreateExpense`, `CreateIncome`, `UpdateTransaction`, `GetDashboardSummary`, `CreateDailyBudget`, `CloseDailyBudget`, `GetPeriodReport`, and `ExportTransactions`.
5. **Presentation stays thin:** Pages, components, hooks, and form handlers collect input, call application use cases through an appropriate application/state layer, and render results. They must not contain SQL, Supabase query logic, or duplicated financial calculations.
6. **Infrastructure stays replaceable:** Supabase is an implementation detail. Keep its client setup, generated database types, query implementations, and error translation in the data/infrastructure layer.
7. **Map at boundaries:** Convert database rows and API payloads into domain entities/models in data mappers. Do not leak raw Supabase response objects into domain or UI code.
8. **Validate at boundaries:** Use Zod (or an equivalent schema validator) for form inputs and server/action/API inputs. Domain use cases must still enforce important business invariants; frontend validation alone is not security.
9. **No duplicated rules:** A financial calculation should have one authoritative implementation in the domain layer and be reused by dashboard, reports, and tests.
10. **Avoid overengineering:** Do not create an interface, factory, or use case for every tiny visual component. Abstractions are required where they protect business logic, isolate infrastructure, or make behavior testable.

### Recommended project structure

Use this as the baseline and adapt only when the chosen Next.js version or routing approach requires it:

```text
src/
  app/                              # Next.js routes, layouts, loading/error boundaries
    (auth)/
    (app)/
    api/                            # Thin HTTP handlers only, if needed
  components/                       # Shared, domain-agnostic UI components
    ui/                             # shadcn/ui components
    layout/
  features/
    transactions/
      domain/
        entities/
        value-objects/
        repositories/               # Repository interfaces/ports
        use-cases/
        services/                   # Pure transaction-related domain services
      data/
        datasources/                # Supabase queries
        dto/
        mappers/
        repositories/               # Repository implementations
      presentation/
        components/
        hooks/
        forms/
        state/                      # Feature state, if required
    budgets/
      domain/
      data/
      presentation/
    reports/
      domain/
      data/
      presentation/
    accounts/
      domain/
      data/
      presentation/
    categories/
      domain/
      data/
      presentation/
  shared/
    domain/                          # Shared money/date types and primitives
    application/                     # Cross-feature orchestration only when justified
    infrastructure/
      supabase/                      # Client factories and generated DB types
    lib/                             # Small framework/tool helpers
    config/
    types/
  tests/
    unit/
    integration/
supabase/
  migrations/
  seed.sql
```

Keep feature-specific code inside its feature. Only move code into `shared/` when it is genuinely reused and has no ownership by one feature. Do not create a generic `utils` folder that becomes a dumping ground for business logic.

### Example request flow

For adding an expense, the expected flow is:

`AddExpenseForm → presentation action/hook → CreateExpense use case → TransactionRepository interface → SupabaseTransactionRepository → Supabase datasource → PostgreSQL`

The repository implementation maps the database result back to a domain transaction. The presentation layer receives a typed result/state and updates the UI. The form must not call `supabase.from('transactions')` directly.

### Domain model and money handling

- Create explicit domain types/entities for `Money`, `Transaction`, `Account`, `Category`, `DailyBudget`, `BudgetAllocation`, and report summaries where they add meaningful rules.
- Represent monetary amounts safely. Prefer integer minor units (for example, poisha) or PostgreSQL `numeric` with a carefully defined conversion strategy. Never use JavaScript floating-point arithmetic as the source of truth for money calculations.
- Define transaction types and statuses as typed domain values/enums, and validate persisted values when mapping from the database.
- Keep date-only concepts (such as a budget day) distinct from timestamps. Apply the user's configured timezone consistently when deciding which day a transaction belongs to.
- Make transfer behavior explicit: a transfer creates linked debit/credit records or a dedicated transfer entity, but must not count as income or expense in reports.
- Use typed domain errors/results for expected failures (validation, not found, duplicate, permission denied). Do not expose raw database errors to users.

### Next.js and Supabase boundaries

- Use the correct Supabase client for each execution context: browser client for permitted client-side operations, server client for authenticated server rendering/actions, and service-role access only in tightly controlled server-only administrative tasks if truly required.
- Never import a service-role key into client bundles. Prefer user-scoped access protected by Row Level Security.
- Keep Server Actions and Route Handlers thin: authenticate/authorize, validate input, invoke an application use case, and translate the result into an HTTP/UI response.
- Server Components should call application services/use cases, not contain business rules or scattered raw queries.
- Do not put secrets, Supabase clients, or server-only modules in shared client-importable modules.
- Keep database migrations as the source of truth for schema changes. Regenerate and commit Supabase database types after schema changes.

### Testing requirements for the architecture

- Unit-test domain entities, value objects, use cases, and money/date/budget calculations without Supabase or a browser.
- Test use cases with fake/in-memory repository implementations; domain tests must not require a live database.
- Integration-test Supabase repository implementations against a local/test Supabase database, including RLS and user-data isolation.
- Add end-to-end tests for sign-in, planning a day, adding planned and unplanned expenses, editing/deleting a transaction, closing the day, and viewing/exporting a report.
- Add regression tests for timezone boundaries, month/year boundaries, leap years, transfers, refunds, zero/negative/large values, and rounding.

### Architecture acceptance criteria

The implementation is not complete unless:

- No UI component, page, hook, or client-side form directly performs Supabase database queries.
- Business calculations are implemented once in domain code and reused across the application.
- Repository interfaces are defined separately from their Supabase implementations.
- Use cases can be unit-tested with fake repositories and without Next.js/Supabase.
- Database DTOs are mapped to domain types at the data boundary.
- Authentication and authorization are enforced server-side and by RLS, not only by hiding UI controls.
- Feature modules have clear ownership and imports do not create circular dependencies.
- The agent documents the architecture, key dependency flows, and where future features should be added.

## 16. Supabase setup --- step-by-step for the project owner

The project owner already has a Supabase account. The following actions
should be completed in the Supabase dashboard before the agent connects
the application. Menu labels can change slightly as Supabase updates its
dashboard.

Create a Supabase project: Sign in to the Supabase Dashboard. Select New
project, choose the organization, enter a project name (for example,
personal-finance-tracker), create a strong database password and save it
securely, choose a region close to the primary users, then create the
project. Wait until provisioning finishes.

Copy the project connection details: Open Project Settings → API (or the
API Keys section in project settings). Copy the Project URL and the
publishable key (older projects may label this the anon/public key).
Give these two values to the agent through a secure environment-variable
configuration. Never expose the secret/service_role key in frontend
code, Git, screenshots, or public documents.

Set up database tables: Open SQL Editor → New query. Ask the agent to
provide a reviewed SQL migration for the schema in this PRD, then run it
in the project SQL Editor. It should create profiles/user settings,
accounts, categories, daily budgets, budget allocations, planned
expenses, transactions, and reminder preferences. Use UUID primary keys,
user_id foreign keys to auth.users, numeric or integer-minor-unit money
storage, timestamps, and appropriate indexes. Do not manually create
tables in the Table Editor if the agent is managing versioned
migrations; choose one approach and keep it consistent.

Enable Row Level Security: For every table containing personal data,
enable RLS. Add policies so authenticated users can SELECT, INSERT,
UPDATE, and DELETE only rows where user_id = auth.uid(). For profile
rows, use the matching auth user id. Ensure related child records cannot
be accessed by changing a parent id. The agent must include and test
policies in the SQL migration; do not rely on frontend filtering for
security.

Configure Authentication: Open Authentication → Providers and ensure
Email is enabled. For a simple MVP, use email/password or email magic
link. Open Authentication → URL Configuration and set the Site URL to
the deployed app URL (during local development, configure the local
callback URL as required). Add the production and local redirect URLs to
the allowed Redirect URLs list. Decide whether email confirmation should
be enabled; for production, keep confirmation enabled unless there is a
deliberate reason not to.

Optional: configure receipt image storage: If the MVP will support
receipt photos, open Storage and create a private bucket named receipts.
Do not make it public. Add Storage policies so a signed-in user can
upload, view, and delete only objects inside their own user-id folder,
for example `<user-id>`{=html}/`<filename>`{=html}. The app should use
short-lived signed URLs when displaying private receipts. If receipt
uploads are postponed, skip this step for the MVP.

Set environment variables in the app: The agent should create a local
.env.local file with NEXT_PUBLIC_SUPABASE_URL and
NEXT_PUBLIC_SUPABASE_ANON_KEY (or the current publishable-key variable
name used by the Supabase SDK). Add .env.local to .gitignore. Configure
the same values in the deployment provider's environment settings. Never
put SUPABASE_SERVICE_ROLE_KEY in a NEXT_PUBLIC\_ variable. If a
service-role key is genuinely required for a trusted server-only task,
store it only as a server-side secret.

Ask the agent to verify the setup: Have the agent run migrations, create
a test user, and verify sign-up/sign-in, CRUD operations, and RLS
isolation. Create two test users and confirm that User A cannot read,
update, or delete User B's accounts, budgets, categories, or
transactions, even by calling the API directly. Also verify that
unauthenticated requests cannot access private records.

Keep schema changes versioned: Ask the agent to store SQL migrations in
the repository (for example, supabase/migrations) and document the exact
command or dashboard procedure used to apply them. Do not make
undocumented production schema changes. Use Supabase backups and export
features appropriate to the selected plan before major changes.

## 17. Supabase security checklist

-   RLS is enabled on every user-owned table and policies are tested for
    every operation.

-   The frontend contains only the project URL and publishable/anon key;
    no service-role key or database password.

-   Receipt storage, if used, is private and protected by user-scoped
    Storage policies.

-   Authentication redirect URLs are restricted to the required local
    and production origins.

-   Database migrations and policy definitions are committed to source
    control.

-   Two-user isolation tests pass before production deployment.

-   The agent documents backup, restore, and account deletion behavior.
    \## 18. What the project owner needs to provide to the agent

-   Supabase Project URL.

-   Supabase publishable key (or anon/public key for a legacy project).

-   Confirmation that the Supabase project has finished provisioning.

-   The preferred deployment platform and production domain, when
    selected.

-   Do not send the database password or service-role key in chat or
    commit them to the repository. Enter secrets directly into the
    agent's secure environment configuration when required. \## 19.
    Updated owner status and remaining Supabase work

Owner status: the project owner has already created the Supabase project
and has the Project ID and API key. Do not ask the owner to recreate the
project or send secrets in chat. The Project ID is mainly an identifier;
the application normally needs the Project URL and publishable key (or
legacy anon key). If the owner only has the Project ID and key, the
agent should explain where to find the Project URL in the Supabase
dashboard.

The following tasks remain. The agent should guide the owner through any
dashboard-only actions and do the code/migration work itself where
possible.

Confirm the connection values: In Supabase Dashboard → Project Settings
→ API (or API Keys), confirm the Project URL and publishable key. Use
the publishable key in the browser client. Never request or expose the
secret/service_role key. If a server-only administrative operation is
genuinely required, explain why first and store that key only as a
server-side deployment secret.

Create and apply versioned migrations: The agent must create SQL
migration files in the repository under supabase/migrations. Include all
tables, foreign keys, constraints, indexes, triggers/functions only
where justified, seed data for default categories, and RLS policies.
Prefer applying migrations with the Supabase CLI linked to the owner
project; if CLI setup is not available, provide a single reviewed SQL
script and guide the owner to run it in SQL Editor. Do not mix
undocumented dashboard table edits with migration-managed schema
changes.

Create profile/settings handling: Implement a profiles table keyed to
auth.users.id and create a safe signup trigger or application-side
profile upsert. Store currency (default BDT), timezone (default
Asia/Dhaka), display name, and preferences. Ensure trigger permissions
and search_path are secure if a database trigger is used.

Configure Auth URLs and email: In Authentication → URL Configuration,
set the local development Site URL and allowed callback URLs, then
replace/add the production domain at deployment. Configure email
confirmation and password reset redirect flows. If using Supabase
default email delivery for production, review its rate limits and
configure custom SMTP before relying on it for real users. Test signup,
confirmation, login, logout, and password reset.

Configure private receipt storage only if included in MVP: Create a
private receipts bucket. Add Storage object policies scoped to the
authenticated user folder. Use private signed URLs for viewing. Validate
file size and MIME type, generate safe unique object names, and remove
associated storage objects when a receipt is deleted if appropriate. If
receipt uploads are deferred, do not block the MVP on this step.

Configure deployment environment: Add NEXT_PUBLIC_SUPABASE_URL and
NEXT_PUBLIC_SUPABASE_ANON_KEY (or the publishable-key variable name
supported by the installed Supabase SDK) to local .env.local and the
deployment platform's environment settings. Add .env.local to
.gitignore. Keep all secrets out of source control and logs. Configure
production Auth redirect URLs after the deployment domain exists.

Verify security and data correctness: Test with at least two separate
users. Confirm User A cannot select, insert, update, or delete User B
records through the UI or direct API calls. Test nested/related rows,
storage paths, unauthenticated access, and account deletion. Verify
transfers do not count as income/expenses and all monetary calculations
use decimal-safe storage.

Backups and production readiness: Review the Supabase project's
backup/restore options for the selected plan. Before production,
document how to export user data, restore a backup, rotate exposed keys,
and handle account deletion. Do not promise point-in-time recovery or
automated backups unless the selected plan actually provides them.

## 20. Frontend UI/UX system --- mandatory

The frontend must use a consistent, production-quality component system
rather than ad-hoc buttons, forms, dialogs, and cards. The selected
implementation standard is shadcn/ui built on Radix UI primitives,
styled with Tailwind CSS. Use Lucide icons. Use Recharts for data
visualizations. The agent may add small supporting libraries where
justified, but must not introduce multiple competing component
libraries.

-   Component foundation: shadcn/ui (Radix UI primitives) + Tailwind
    CSS. Initialize the component system and theme tokens early; use its
    accessible Button, Input, Select, Checkbox, Tabs, Dialog, Sheet,
    Dropdown Menu, Tooltip, Popover, Calendar/Date Picker, Table, Card,
    Badge, Skeleton, Toast/Sonner, Alert Dialog, and Form patterns where
    applicable.
-   Forms and validation: React Hook Form + Zod. Provide inline field
    errors, sensible defaults, clear required/optional labels, and
    prevent accidental duplicate submissions.
-   Icons: Lucide React. Do not mix unrelated icon packs.
-   Charts: Recharts with responsive containers, readable axes, legends,
    tooltips, empty states, and text summaries for accessibility.
-   Tables/lists: use a consistent transaction list with date grouping,
    amount alignment, clear income/expense signs, filters, sorting, and
    mobile-friendly card/list behavior.
-   Design tokens: define semantic CSS variables for background,
    foreground, card, muted, border, primary, success, warning,
    destructive, chart colors, radius, spacing, and focus ring. Use
    semantic tokens rather than scattered hard-coded colors.
-   Visual direction: create a calm, trustworthy personal-finance
    product. Use a restrained neutral foundation with a distinctive but
    controlled accent color. Avoid generic purple gradients, excessive
    glassmorphism, excessive rounded cards, decorative charts, and
    cluttered dashboards.
-   Information hierarchy: the most important daily number is "Left for
    today". Make planned, spent, unplanned, and remaining values
    visually distinct. Use color as a secondary cue, never the only cue.
-   Responsive behavior: design mobile-first. On mobile, prioritize
    quick expense entry and today's remaining budget; use a compact
    navigation pattern and bottom-sheet/dialog patterns where
    appropriate. Desktop can use a persistent sidebar and wider
    analytics layout.
-   Accessibility: target WCAG 2.2 AA where practical; keyboard
    navigation, visible focus states, semantic labels, accessible
    dialogs, sufficient contrast, reduced-motion support, and chart
    summaries are required.
-   Interaction quality: implement loading skeletons, optimistic updates
    only where safe, empty states with next-step actions, confirmation
    for destructive actions, success/error feedback, and helpful
    validation copy.
-   Consistency: use the same spacing scale, type scale, button
    hierarchy, form behavior, date formatting, currency formatting, and
    status vocabulary across every screen. \## 21. Claude Code skills
    and frontend workflow --- mandatory

The implementation agent is expected to use Claude Code and its Agent
Skills where available. Before building the UI, install or confirm the
official Anthropic Frontend Design skill and explicitly invoke it for
the design phase. If the skill is already installed, do not reinstall
it.

Official skill installation option (run inside Claude Code):

-   /plugin marketplace add anthropics/skills
-   /plugin install example-skills@anthropic-agent-skills Then invoke
    the installed frontend design skill (the exact slash-command
    namespace may be shown by Claude Code after installation) or ask
    Claude Code to load and follow the frontend-design skill before
    implementation. The agent must verify that the skill is available
    rather than claiming it was used.

Required design workflow:

1.  Inspect the project and existing dependencies before changing
    anything.
2.  Read and follow the Frontend Design skill instructions.
3.  Write a short design brief: audience, primary user task, visual
    direction, palette, typography, spacing scale, component rules, and
    responsive navigation.
4.  Create a compact design-token system and a screen-by-screen
    wireframe before implementing components.
5.  Build the app using the shadcn/ui component system and the agreed
    tokens; do not replace the system with one-off custom components
    without a reason.
6.  Review screenshots at desktop and mobile widths; critique visual
    hierarchy, density, alignment, typography, chart readability, and
    empty/error/loading states.
7.  Run accessibility checks and keyboard-only review on core flows; fix
    issues before declaring completion.
8.  Do a final consistency pass across Dashboard, Plan Today, Add
    Transaction, Transactions, Reports, and Settings. \## 22. Required
    frontend screens and UX details

  -----------------------------------------------------------------------
  Screen                              UX requirements
  ----------------------------------- -----------------------------------
  Dashboard                           Show "Left for today" as the
                                      dominant metric; daily budget
                                      progress; spent/unplanned totals;
                                      quick Add Expense action; recent
                                      transactions; small category
                                      summary.

  Plan Today                          Simple total limit input; category
                                      allocation editor; total allocation
                                      vs daily limit validation; copy
                                      previous day/template; save and
                                      edit plan.

  Quick Add Expense                   Amount-first form; category and
                                      payment method; planned/unplanned
                                      toggle; date/time defaulted to now;
                                      optional merchant/note/receipt; one
                                      clear Save Expense action.

  Transactions                        Search, date range, category,
                                      account, and planned-status
                                      filters; grouped rows; edit/delete;
                                      mobile-friendly layout.

  Reports                             Period selector; income, expense,
                                      net cash flow, and closing balance
                                      cards; category donut; daily/weekly
                                      trend; planned-vs-actual chart;
                                      unplanned spending callout; CSV
                                      export.

  Settings                            Profile, currency, timezone,
                                      categories, accounts/payment
                                      methods, reminders, export, and
                                      account/data deletion.
  -----------------------------------------------------------------------

## 23. Final handoff checklist for the agent

-   Working deployed application connected to the owner's existing
    Supabase project.

-   All SQL migrations committed to the repository and documented.

-   RLS enabled and tested for every user-owned table.

-   Authentication flows tested, including confirmation and password
    reset.

-   shadcn/ui + Radix + Tailwind component foundation implemented
    consistently.

-   Anthropic Frontend Design skill availability verified and used for
    the UI design workflow.

-   Core responsive screens complete with loading, empty, error, and
    success states.

-   Charts and financial calculations verified against test cases.

-   Two-user isolation tests pass; no secret keys committed or exposed.

-   README includes local setup, environment variables, migrations, seed
    process, tests, and deployment steps.

-   Owner receives a clear list of any remaining manual Supabase
    dashboard actions. \## 24. Reference links for the agent

-   Supabase Dashboard: https://supabase.com/dashboard

-   Supabase documentation: https://supabase.com/docs

-   shadcn/ui documentation: https://ui.shadcn.com/docs

-   Tailwind CSS documentation: https://tailwindcss.com/docs

-   Anthropic official skills repository:
    https://github.com/anthropics/skills

-   Anthropic Frontend Design plugin listing:
    https://claude.com/marketplace/plugins/frontend-design

## 25. Typography, font selection, and responsive design — mandatory

The interface must use a deliberate typography system and must be carefully designed and tested across phone, tablet, laptop, and large desktop sizes. Responsiveness is a core product requirement, not a final CSS polish task.

### Font system

- Use **Inter** as the primary interface font for the English-language experience. It is highly legible for dashboards, forms, tables, labels, and dense financial information.
- If the product supports Bangla text, use **Noto Sans Bengali** for Bengali glyphs, with Inter retained for Latin text where appropriate. Define a reliable fallback stack such as `Inter, "Noto Sans Bengali", system-ui, sans-serif` and verify mixed Bangla/English strings render cleanly.
- Load fonts through `next/font` (or self-hosted font files) to avoid layout shifts and unnecessary third-party requests. Prefer only the weights actually used (for example, 400, 500, 600, and 700).
- Establish consistent typography tokens for page titles, section headings, card values, body text, helper text, labels, and captions. Do not choose font sizes ad hoc in individual components.
- Use tabular numerals for balances, currency amounts, percentages, and chart values where supported (`font-variant-numeric: tabular-nums`) so figures align and are easy to compare.
- Keep financial figures highly legible. Avoid overly thin font weights, excessively small labels, all-caps paragraphs, decorative fonts, and low-contrast muted text.
- Use a consistent line-height and spacing system. Long transaction names, category names, and notes must wrap or truncate gracefully without breaking the layout.
- Test the BDT symbol (৳), decimal separators, negative values, large amounts, dates, and mixed-language content in the chosen fonts. Never assume a font supports every required glyph.

### Responsive layout requirements

- Design mobile-first, then progressively enhance for tablet, laptop, and wide desktop. Do not simply shrink the desktop dashboard to fit a phone.
- Define and document responsive breakpoints in the design tokens. Use content-driven breakpoints where practical; a reasonable starting point is around 640px, 768px, 1024px, and 1280px, but adjust them based on actual component fit.
- At phone widths, use a single-column content layout, compact page headers, readable cards, and a clear mobile navigation pattern (such as a bottom navigation bar or an accessible compact menu). Keep the primary Add Expense action easy to reach.
- At tablet widths, use a balanced two-column layout only where the content genuinely benefits from it. Avoid squeezing charts, forms, and summary cards into narrow columns.
- At desktop widths, use a restrained maximum content width, a consistent sidebar/navigation region, and grid layouts that use available space without stretching text or cards excessively.
- Forms must adapt to available width: stack fields on small screens, use multi-column groups only when there is sufficient room, and keep labels and validation messages visible.
- Transaction history must not require horizontal scrolling on a typical phone. Use a compact card/list presentation on small screens and a richer table on larger screens. Preserve the same information and actions across both layouts.
- Charts must resize with their containers. On small screens, simplify tick labels, legends, and chart density; allow legends to wrap or move below charts. Never clip chart labels or make users depend on hover-only tooltips on touch devices.
- Modals and dialogs must fit within the viewport, support scrolling internally when necessary, and keep their primary action visible and reachable. Consider using full-screen or bottom-sheet patterns on narrow screens where appropriate.
- Use touch targets of approximately 44 by 44 CSS pixels or larger for primary interactive controls. Provide visible keyboard focus and do not rely on hover for essential actions.
- Prevent horizontal page overflow at all supported widths. Long text, large currency values, tables, charts, navigation, and dialogs must be handled intentionally.
- Respect safe-area insets on modern mobile devices, including bottom navigation and fixed action areas. Do not let sticky elements cover content or form controls.
- Support portrait and landscape orientation. Ensure the app remains usable when the mobile keyboard is open, especially during transaction entry.
- Use responsive images and avoid shipping unnecessarily large assets to mobile devices. Keep layout shifts low while fonts, charts, and data load.

### Responsive and typography verification

The agent must verify the real running application at, at minimum, these viewport sizes:

- 360 × 800 — small Android phone.
- 390 × 844 — common modern phone.
- 430 × 932 — large phone.
- 768 × 1024 — tablet portrait.
- 1024 × 768 — tablet landscape / compact laptop.
- 1366 × 768 — common laptop.
- 1440 × 900 — desktop.
- 1920 × 1080 — wide desktop.

At each relevant size, inspect Dashboard, Plan Today, Quick Add Expense, Transactions, Reports, and Settings. Check for overflow, clipped text, overlapping controls, awkward whitespace, unreadable charts, modal overflow, and navigation problems. Also test browser zoom at 200%, keyboard navigation, and a touch device or touch emulation.

### Typography and responsive acceptance criteria

- The chosen font family and weights are documented and loaded efficiently; all required currency and language glyphs render correctly.
- Typography tokens are consistent across all screens, with tabular numerals for financial values.
- No core screen has unintended horizontal page scrolling at the specified phone widths.
- Every core task can be completed on a phone without desktop-only controls or hover interactions.
- Transaction lists, reports, charts, forms, dialogs, and navigation each have an intentional small-screen layout.
- Touch targets, text contrast, focus indicators, and zoom behavior are checked as part of accessibility review.
- Screenshots from phone, tablet, and desktop reviews are included in the implementation handoff, along with any known responsive limitations.

The agent must not mark the project complete based only on a desktop preview. Responsive behavior and typography must be reviewed on the actual implemented screens before delivery.
