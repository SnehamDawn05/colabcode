import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma, verifyWorkspacePermission } from "@/lib/db";
import { UpdateMemberRoleSchema } from "@colab-code/validation";
import { z } from "zod";

// PATCH /api/workspaces/[id]/members/[memberId] - Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = await verifyWorkspacePermission(params.id, session.user.id, "OWNER");
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only workspace owners can update member roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateMemberRoleSchema.parse(body);

    const prisma = getPrisma();

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: params.memberId },
    });

    if (!targetMember || targetMember.workspaceId !== params.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // If demoting an OWNER, ensure there is at least one other OWNER remaining
    if (targetMember.role === "OWNER" && parsed.role !== "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: params.id, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot change role: A workspace must have at least one owner" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: params.memberId },
      data: { role: parsed.role },
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error updating member role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/members/[memberId] - Remove a member (or leave workspace)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: params.memberId },
    });

    if (!targetMember || targetMember.workspaceId !== params.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isSelf = targetMember.userId === session.user.id;
    const isOwner = await verifyWorkspacePermission(params.id, session.user.id, "OWNER");

    // Only workspace owners or the member themselves can remove the membership
    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: "You do not have permission to remove this member" },
        { status: 403 }
      );
    }

    // Ensure the last OWNER cannot be removed
    if (targetMember.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: params.id, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the only owner of the workspace" },
          { status: 400 }
        );
      }
    }

    await prisma.workspaceMember.delete({
      where: { id: params.memberId },
    });

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing workspace member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
