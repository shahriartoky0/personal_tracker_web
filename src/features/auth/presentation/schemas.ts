import { z } from "zod"

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address")

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number")

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") })

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
})

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })
