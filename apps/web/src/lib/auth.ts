import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@colab-code/db";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret:
    process.env.AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "colab-code-super-secret-key-32-characters-minimum-for-better-auth",
  baseURL:
    process.env.NEXT_PUBLIC_API_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [],
  emailVerification: {
    sendVerificationEmail: async (data) => {
      console.log(`Verification email sent to ${data.user.email}`);
      console.log(`Verification URL: ${data.url}`);
    },
  },
});

export type Session = typeof auth.$Infer.Session;
