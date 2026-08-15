import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma, getUserWorkspaces } from "@/lib/db";
import { CreateWorkspaceSchema } from "@colab-code/validation";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await getUserWorkspaces(session.user.id);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateWorkspaceSchema.parse(body);

    const prisma = getPrisma();

    // Generate unique slug
    const slug = parsed.name.toLowerCase().replace(/\s+/g, "-");
    let counter = 0;
    let finalSlug = slug;

    while (
      await prisma.workspace.findUnique({
        where: { slug: finalSlug },
      })
    ) {
      counter++;
      finalSlug = `${slug}-${counter}`;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.name,
        slug: finalSlug,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error creating workspace:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
