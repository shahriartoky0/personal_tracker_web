import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createSupabaseServerClient, type SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { AccountDatasource } from "@/features/accounts/data/datasources/account-datasource"
import { SupabaseAccountRepository } from "@/features/accounts/data/repositories/supabase-account-repository"
import { CreateAccount, ListAccounts, UpdateAccount } from "@/features/accounts/domain/use-cases/account-use-cases"
import { CategoryDatasource } from "@/features/categories/data/datasources/category-datasource"
import { SupabaseCategoryRepository } from "@/features/categories/data/repositories/supabase-category-repository"
import { CreateCategory, ListCategories, UpdateCategory } from "@/features/categories/domain/use-cases/category-use-cases"
import { TransactionDatasource } from "@/features/transactions/data/datasources/transaction-datasource"
import { SupabaseTransactionRepository } from "@/features/transactions/data/repositories/supabase-transaction-repository"
import {
  CreateExpense,
  CreateIncome,
  CreateTransfer,
  DeleteTransaction,
  DuplicateTransaction,
  ExportTransactions,
  ListTransactions,
  UpdateTransaction,
} from "@/features/transactions/domain/use-cases/transaction-use-cases"
import { BudgetDatasource } from "@/features/budgets/data/datasources/budget-datasource"
import { SupabaseBudgetRepository } from "@/features/budgets/data/repositories/supabase-budget-repository"
import {
  CloseDailyBudget,
  CopyPreviousPlan,
  CreateDailyBudget,
  GetDailyBudget,
  ManagePlannedExpenses,
  SaveBudgetTemplate,
} from "@/features/budgets/domain/use-cases/budget-use-cases"
import { GetPeriodReport } from "@/features/reports/domain/use-cases/get-period-report"
import { GetDashboardSummary } from "@/shared/application/get-dashboard-summary"
import {
  SupabaseProfileRepository,
  SupabaseReminderRepository,
} from "@/features/settings/data/repositories/supabase-settings-repositories"
import { DeleteAllMyData, GetProfile, ManageReminders, UpdateProfile } from "@/features/settings/domain/use-cases/settings-use-cases"
import { SupabasePayeeRepository } from "@/features/transfers/data/repositories/supabase-payee-repository"
import { SupabaseProofStorage } from "@/features/transfers/data/repositories/supabase-proof-storage"
import {
  GetProofUrl,
  GetTransferTracker,
  ListPayees,
  RecordPersonTransfer,
  RemoveProof,
  UpdatePersonTransfer,
  UploadProof,
} from "@/features/transfers/domain/use-cases/transfer-use-cases"
import { SupabaseAuthGateway } from "@/features/auth/data/repositories/supabase-auth-gateway"

/** Per-request memo of list(): layout, page and use cases all read accounts/categories; fetch once. */
function memoList<T extends { list(): Promise<unknown[]>; create(...a: never[]): Promise<unknown>; update(...a: never[]): Promise<unknown> }>(repo: T): T {
  let cached: ReturnType<T["list"]> | null = null
  const invalidate = <F extends (...a: never[]) => Promise<unknown>>(fn: F) =>
    (async (...a: Parameters<F>) => {
      cached = null
      return fn.apply(repo, a)
    }) as F
  return Object.assign(Object.create(repo), {
    list: () => (cached ??= repo.list() as ReturnType<T["list"]>),
    create: invalidate(repo.create.bind(repo) as never),
    update: invalidate(repo.update.bind(repo) as never),
  }) as T
}

function memoProfile(repo: SupabaseProfileRepository): SupabaseProfileRepository {
  let cached: ReturnType<SupabaseProfileRepository["get"]> | null = null
  return Object.assign(Object.create(repo), {
    get: () => (cached ??= repo.get()),
    update: async (...a: Parameters<SupabaseProfileRepository["update"]>) => {
      cached = null
      return repo.update(...a)
    },
  })
}

/** Composition root: the only place that wires Supabase implementations to domain use cases. */
function build(db: SupabaseServerClient, userId: string, email: string) {
  const accounts = memoList(new SupabaseAccountRepository(new AccountDatasource(db), userId))
  const categories = memoList(new SupabaseCategoryRepository(new CategoryDatasource(db), userId))
  const transactions = new SupabaseTransactionRepository(new TransactionDatasource(db), userId)
  const budgets = new SupabaseBudgetRepository(new BudgetDatasource(db), userId)
  const profiles = memoProfile(new SupabaseProfileRepository(db, userId))
  const reminders = new SupabaseReminderRepository(db, userId)
  const payees = new SupabasePayeeRepository(db, userId)
  const proofs = new SupabaseProofStorage(db, userId)
  const txDeps = { transactions, accounts, categories, payees }
  const transferDeps = { transactions, accounts, payees, proofs }

  return {
    userId,
    email,
    auth: new SupabaseAuthGateway(db),
    accounts: { list: new ListAccounts(accounts), create: new CreateAccount(accounts), update: new UpdateAccount(accounts) },
    categories: {
      list: new ListCategories(categories),
      create: new CreateCategory(categories),
      update: new UpdateCategory(categories),
    },
    transactions: {
      createExpense: new CreateExpense(txDeps),
      createIncome: new CreateIncome(txDeps),
      createTransfer: new CreateTransfer(txDeps),
      update: new UpdateTransaction(txDeps),
      delete: new DeleteTransaction(transactions, proofs),
      duplicate: new DuplicateTransaction(txDeps),
      list: new ListTransactions(transactions),
      export: new ExportTransactions(txDeps),
    },
    transfers: {
      record: new RecordPersonTransfer(transferDeps),
      update: new UpdatePersonTransfer(transferDeps),
      tracker: new GetTransferTracker(transactions, payees),
      payees: new ListPayees(payees),
      uploadProof: new UploadProof(proofs),
      proofUrl: new GetProofUrl(proofs),
      removeProof: new RemoveProof(proofs),
    },
    budgets: {
      get: new GetDailyBudget(budgets),
      save: new CreateDailyBudget(budgets, categories),
      copy: new CopyPreviousPlan(budgets),
      saveTemplate: new SaveBudgetTemplate(budgets),
      close: new CloseDailyBudget(budgets),
      planned: new ManagePlannedExpenses(budgets, categories),
    },
    reports: new GetPeriodReport({ transactions, accounts, budgets }),
    dashboard: new GetDashboardSummary({ transactions, accounts, budgets }),
    settings: {
      profile: new GetProfile(profiles),
      updateProfile: new UpdateProfile(profiles),
      reminders: new ManageReminders(reminders),
      deleteAllData: new DeleteAllMyData(transactions, budgets),
    },
  }
}

export type Container = ReturnType<typeof build>

/** Signed-in container for this request, or null. Session is verified locally from the JWT; data access is still enforced by RLS. */
export const getContainer = cache(async (): Promise<Container | null> => {
  const db = await createSupabaseServerClient()
  const { data } = await db.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return build(db, claims.sub, typeof claims.email === "string" ? claims.email : "")
})

export async function requireContainer(): Promise<Container> {
  const c = await getContainer()
  if (!c) redirect("/login")
  return c
}

/** Auth-only gateway for pages that run before sign-in. */
export async function getAuthGateway() {
  return new SupabaseAuthGateway(await createSupabaseServerClient())
}
