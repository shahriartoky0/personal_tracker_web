import { SignInForm } from "@/features/auth/presentation/components/auth-forms"

export const metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <>
      <h1 className="text-title mb-1">Welcome back</h1>
      <p className="mb-5 text-sm text-muted-foreground">Sign in to plan today and track every taka.</p>
      {error && <p role="alert" className="mb-4 rounded-md bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}
      <SignInForm />
    </>
  )
}
