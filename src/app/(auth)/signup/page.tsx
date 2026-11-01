import { SignUpForm } from "@/features/auth/presentation/components/auth-forms"

export const metadata = { title: "Create account" }

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-title mb-1">Create your account</h1>
      <p className="mb-5 text-sm text-muted-foreground">Your data is private — only you can see it.</p>
      <SignUpForm />
    </>
  )
}
