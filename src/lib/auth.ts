import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: async () => {
    const origins: string[] = [];
    const add = (v?: string) => {
      if (v && !origins.includes(v)) origins.push(v);
    };
    // Local/dev
    add(process.env.BETTER_AUTH_URL || "http://localhost:3000");
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");
    add("http://[::1]:3000");
    // Vercel preview/prod
    if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`);
    // Custom domains (update as needed)
    add("https://shags-n8n.site");
    add("https://www.shags-n8n.site");
    // Allow all subdomains of the custom domain for flexibility
    add("https://*.shags-n8n.site");
    return origins;
  },
  plugins: [nextCookies()],
});
