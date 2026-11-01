import { redirect } from "next/navigation"
import { getContainer } from "@/shared/infrastructure/container"
import { ResetPasswordForm } from "@/features/auth/presentation/components/auth-forms"

export const metadata = { title: "Choose a new password" }

export default async function ResetPasswordPage() {
  // Reached from the emailed recovery link, which signs the user in via /auth/callback.
  if (!(await getContainer())) redirect("/login?error=" + encodeURIComponent("That reset link is invalid or has expired."))
  return (
    <>
      <h1 className="text-title mb-1">Choose a new password</h1>
      <p className="mb-5 text-sm text-muted-foreground">Use at least 8 characters with a letter and a number.</p>
      <ResetPasswordForm />
    </>
  )
}
