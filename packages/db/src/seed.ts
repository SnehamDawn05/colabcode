import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  console.log("Clearing existing data...");
  await prisma.chatMessage.deleteMany();
  await prisma.workspaceSnapshot.deleteMany();
  await prisma.file.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  console.log("Creating users...");
  const password = await hashPassword("password123");

  const user1 = await prisma.user.create({
    data: {
      email: "alice@example.com",
      name: "Alice Developer",
      emailVerified: true,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      accounts: {
        create: {
          accountId: "alice@example.com",
          providerId: "credential",
          password,
        },
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "bob@example.com",
      name: "Bob Coder",
      emailVerified: true,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      accounts: {
        create: {
          accountId: "bob@example.com",
          providerId: "credential",
          password,
        },
      },
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: "charlie@example.com",
      name: "Charlie Engineer",
      emailVerified: true,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
      accounts: {
        create: {
          accountId: "charlie@example.com",
          providerId: "credential",
          password,
        },
      },
    },
  });

  console.log("✅ Created users");

  // Create demo workspace
  console.log("Creating workspace...");
  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      slug: "demo-workspace",
    },
  });

  console.log("✅ Created workspace");

  // Add members
  console.log("Adding members...");
  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user1.id,
      role: "OWNER",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user2.id,
      role: "EDITOR",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user3.id,
      role: "VIEWER",
    },
  });

  console.log("✅ Added members");

  // Create folder structure
  console.log("Creating folder structure...");
  const srcFolder = await prisma.folder.create({
    data: {
      name: "src",
      workspaceId: workspace.id,
    },
  });

  const utilsFolder = await prisma.folder.create({
    data: {
      name: "utils",
      workspaceId: workspace.id,
      parentId: srcFolder.id,
    },
  });

  console.log("✅ Created folders");

  // Create files
  console.log("Creating files...");
  await prisma.file.create({
    data: {
      name: "main.cpp",
      language: "cpp",
      content: `#include <iostream>

int main() {
    std::cout << "Hello, Colab Code!" << std::endl;
    return 0;
}`,
      workspaceId: workspace.id,
      folderId: srcFolder.id,
    },
  });

  await prisma.file.create({
    data: {
      name: "helpers.ts",
      language: "typescript",
      content: `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`,
      workspaceId: workspace.id,
      folderId: utilsFolder.id,
    },
  });

  await prisma.file.create({
    data: {
      name: "README.md",
      language: "markdown",
      content: `# Demo Workspace

This is a collaborative code editor workspace.

## Features
- Real-time editing
- Multiple users
- Syntax highlighting
- File management`,
      workspaceId: workspace.id,
    },
  });

  await prisma.file.create({
    data: {
      name: "package.json",
      language: "json",
      content: `{
  "name": "demo-project",
  "version": "1.0.0",
  "description": "A collaborative demo project",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}`,
      workspaceId: workspace.id,
    },
  });

  console.log("✅ Created files");

  // Create some demo chat messages
  console.log("Creating chat messages...");
  await prisma.chatMessage.create({
    data: {
      content: "Hey everyone, let's start collaborating!",
      workspaceId: workspace.id,
      userId: user1.id,
    },
  });

  await prisma.chatMessage.create({
    data: {
      content: "Great! I'm ready to code.",
      workspaceId: workspace.id,
      userId: user2.id,
    },
  });

  console.log("✅ Created chat messages");

  console.log("\n✨ Database seeded successfully!");
  console.log("\nDemo Accounts:");
  console.log("  Email: alice@example.com | Password: password123 (Owner)");
  console.log("  Email: bob@example.com | Password: password123 (Editor)");
  console.log("  Email: charlie@example.com | Password: password123 (Viewer)");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
