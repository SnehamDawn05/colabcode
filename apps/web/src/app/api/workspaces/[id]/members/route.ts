import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma, getUserByEmail, verifyWorkspacePermission } from "@/lib/db";
import { InviteMemberSchema } from "@colab-code/validation";
import { z } from "zod";

// GET /api/workspaces/[id]/members - List all members of the workspace
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await verifyWorkspacePermission(params.id, session.user.id, "VIEWER");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching workspace members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/workspaces/[id]/members - Invite / add a member by email
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER can invite new members
    const isOwner = await verifyWorkspacePermission(params.id, session.user.id, "OWNER");
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only workspace owners can invite new members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = InviteMemberSchema.parse(body);

    const targetUser = await getUserByEmail(parsed.email.toLowerCase().trim());
    if (!targetUser) {
      return NextResponse.json(
        { error: `User with email "${parsed.email}" was not found. Please ensure they have registered.` },
        { status: 404 }
      );
    }

    const prisma = getPrisma();

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.id,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: `User "${parsed.email}" is already a member of this workspace.` },
        { status: 400 }
      );
    }

    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId: params.id,
        userId: targetUser.id,
        role: parsed.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error inviting workspace member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
