import { z } from "zod";

// Auth schemas
export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  image: z.string().url("Invalid image URL").optional(),
});

// Workspace schemas
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(255),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(255).optional(),
});

// File schemas
export const CreateFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  folderId: z.string().optional(),
  language: z.string().default("javascript"),
  content: z.string().default(""),
});

export const UpdateFileSchema = z.object({
  name: z.string().min(1, "File name is required").optional(),
  content: z.string().optional(),
  language: z.string().optional(),
});

// Folder schemas
export const CreateFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string().optional(),
});

export const UpdateFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
});

// Chat schemas
export const SendChatMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
});

// Member schemas
export const AddMemberSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]).default("EDITOR"),
});

export const InviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]).default("EDITOR"),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
});

// Type exports
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
export type CreateFileInput = z.infer<typeof CreateFileSchema>;
export type UpdateFileInput = z.infer<typeof UpdateFileSchema>;
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;
export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
