import { ForgotPasswordForm } from "@/features/auth/presentation/components/auth-forms"

export const metadata = { title: "Reset password" }

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-title mb-1">Reset your password</h1>
      <p className="mb-5 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
    </>
  )
}
