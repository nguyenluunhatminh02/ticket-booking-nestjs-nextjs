import { z } from "zod";

/* ===== Shared password rules ===== */

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a digit")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Must contain a special character");

/* ===== Auth Schemas ===== */

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().min(2, "Min 2 characters").max(50, "Max 50 characters"),
    lastName: z.string().min(2, "Min 2 characters").max(50, "Max 50 characters"),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    phoneNumber: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    logoutAllDevices: z.boolean().optional().default(false),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const mfaVerifySchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type MfaVerifyFormValues = z.infer<typeof mfaVerifySchema>;

export const mfaSetupConfirmSchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type MfaSetupConfirmFormValues = z.infer<typeof mfaSetupConfirmSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type ResendVerificationFormValues = z.infer<typeof resendVerificationSchema>;

/* ===== User Schemas ===== */

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phoneNumber: z.string().max(20).optional(),
  username: z.string().max(50).optional(),
});
export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

export const deactivateAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  reason: z.string().optional(),
});
export type DeactivateAccountFormValues = z.infer<typeof deactivateAccountSchema>;

/* ===== Device Schemas ===== */

export const renameDeviceSchema = z.object({
  deviceName: z.string().min(1, "Name is required").max(255),
});
export type RenameDeviceFormValues = z.infer<typeof renameDeviceSchema>;
