import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma, verifyWorkspacePermission } from "@/lib/db";
import { UpdateFolderSchema } from "@colab-code/validation";
import { z } from "zod";

// GET /api/workspaces/[id]/folders/[folderId]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
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
    const folder = await prisma.folder.findFirst({
      where: {
        id: params.folderId,
        workspaceId: params.id,
      },
      include: {
        children: true,
        files: true,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error fetching folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/workspaces/[id]/folders/[folderId] - Rename folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await verifyWorkspacePermission(params.id, session.user.id, "EDITOR");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = UpdateFolderSchema.parse(body);

    const prisma = getPrisma();
    const folder = await prisma.folder.findFirst({
      where: {
        id: params.folderId,
        workspaceId: params.id,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const updated = await prisma.folder.update({
      where: { id: params.folderId },
      data: { name: parsed.name },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error updating folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/folders/[folderId] - Delete folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await verifyWorkspacePermission(params.id, session.user.id, "EDITOR");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    const folder = await prisma.folder.findFirst({
      where: {
        id: params.folderId,
        workspaceId: params.id,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Find all descendant folder IDs recursively
    const allWorkspaceFolders = await prisma.folder.findMany({
      where: { workspaceId: params.id },
    });

    const folderIdsToDelete = new Set<string>([params.folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allWorkspaceFolders) {
        if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id);
          added = true;
        }
      }
    }

    // Delete all files in any of the folders being deleted
    await prisma.file.deleteMany({
      where: {
        workspaceId: params.id,
        folderId: { in: Array.from(folderIdsToDelete) },
      },
    });

    await prisma.folder.delete({
      where: { id: params.folderId },
    });

    return NextResponse.json({ message: "Folder and contained files deleted" });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
