import { prisma } from "./db";
import { getSecretWithValue } from "./secrets";

export interface UserAiSettings {
  openRouterModelId: string | null;
  openRouterSecretId: string | null;
}

export async function getUserSettings(userId: string): Promise<UserAiSettings | null> {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      openRouterModelId: true,
      openRouterSecretId: true,
    },
  });
  return row;
}

export async function upsertUserSettings(
  userId: string,
  data: {
    openRouterModelId?: string | null;
    openRouterSecretId?: string | null;
  }
): Promise<UserAiSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      openRouterModelId: data.openRouterModelId ?? null,
      openRouterSecretId: data.openRouterSecretId ?? null,
    },
    update: {
      ...(data.openRouterModelId !== undefined && {
        openRouterModelId: data.openRouterModelId,
      }),
      ...(data.openRouterSecretId !== undefined && {
        openRouterSecretId: data.openRouterSecretId,
      }),
    },
    select: {
      openRouterModelId: true,
      openRouterSecretId: true,
    },
  });
}

/** API key from vault + model from user settings. No .env OpenRouter keys. */
export async function resolveOpenRouterForUser(userId: string): Promise<{
  apiKey: string;
  model: string;
  referer: string;
} | null> {
  return resolveOpenRouterWithModelOverride(userId, null);
}

/**
 * API key from vault; model = override if set, else saved default.
 * Requires a non-empty effective model and configured secret.
 */
export async function resolveOpenRouterWithModelOverride(
  userId: string,
  modelIdOverride: string | null
): Promise<{ apiKey: string; model: string; referer: string } | null> {
  const settings = await getUserSettings(userId);
  if (!settings?.openRouterSecretId) return null;
  const model = (
    modelIdOverride?.trim() ||
    settings.openRouterModelId?.trim() ||
    ""
  ).trim();
  if (!model) return null;
  try {
    const s = await getSecretWithValue(userId, settings.openRouterSecretId);
    const apiKey = s.value.trim();
    if (!apiKey) return null;
    const referer =
      process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
    return { apiKey, model, referer };
  } catch {
    return null;
  }
}
