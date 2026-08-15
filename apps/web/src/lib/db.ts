import { PrismaClient } from "@colab-code/db";

const prisma = new PrismaClient();

export const getPrisma = () => prisma;

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getWorkspace(id: string) {
  return prisma.workspace.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
      },
      files: true,
      folders: true,
    },
  });
}

export async function getUserWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
      _count: {
        select: { members: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function verifyWorkspacePermission(
  workspaceId: string,
  userId: string,
  requiredRole: "OWNER" | "EDITOR" | "VIEWER"
) {
  const member = await getWorkspaceMember(workspaceId, userId);

  if (!member) {
    return false;
  }

  const roleHierarchy = { OWNER: 3, EDITOR: 2, VIEWER: 1 };
  return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
}
