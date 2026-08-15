import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma, verifyWorkspacePermission } from "@/lib/db";
import { UpdateFileSchema } from "@colab-code/validation";
import { EXTENSION_TO_LANGUAGE } from "@colab-code/shared";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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
    const file = await prisma.file.findFirst({
      where: {
        id: params.fileId,
        workspaceId: params.id,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json(file);
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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
    const parsed = UpdateFileSchema.parse(body);

    const prisma = getPrisma();
    const existingFile = await prisma.file.findFirst({
      where: {
        id: params.fileId,
        workspaceId: params.id,
      },
    });

    if (!existingFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // If file name changed and language wasn't explicitly provided, infer language from extension
    let language = parsed.language;
    if (parsed.name && !language) {
      const ext = parsed.name.split(".").pop()?.toLowerCase();
      if (ext && ext in EXTENSION_TO_LANGUAGE) {
        language = EXTENSION_TO_LANGUAGE[ext];
      }
    }

    const updated = await prisma.file.update({
      where: { id: params.fileId },
      data: {
        ...parsed,
        ...(language ? { language } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error updating file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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
    const file = await prisma.file.deleteMany({
      where: {
        id: params.fileId,
        workspaceId: params.id,
      },
    });

    if (file.count === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "File deleted" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
