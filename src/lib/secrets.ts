import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

export interface SecretInput {
  name: string;
  value: string;
  description?: string | null;
}

export interface SecretUpdateInput {
  name?: string;
  value?: string;
  description?: string | null;
}

export interface SecretSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretWithValue extends SecretSummary {
  value: string;
}

const summarySelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<string, boolean>;

function normalizeInputName(name?: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  return trimmed;
}

function normalizeDescription(description?: string | null): string | null {
  if (description === undefined) return null;
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

async function getSecretRecord(id: string) {
  return prisma.secret.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      ciphertext: true,
      iv: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listSecrets(userId: string): Promise<SecretSummary[]> {
  return prisma.secret.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: summarySelect,
  });
}

export async function createSecret(
  userId: string,
  input: SecretInput
): Promise<SecretSummary> {
  const name = normalizeInputName(input.name);
  const description = normalizeDescription(input.description);
  if (!input.value?.length) {
    throw new Error("Value is required");
  }

  const { ciphertext, iv } = encryptSecret(input.value);

  try {
    return await prisma.secret.create({
      data: { userId, name, description, ciphertext, iv },
      select: summarySelect,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("A secret with this name already exists");
    }
    throw err;
  }
}

export async function getSecretWithValue(
  userId: string,
  id: string
): Promise<SecretWithValue> {
  const secret = await getSecretRecord(id);
  if (!secret || secret.userId !== userId) {
    throw new Error("Secret not found");
  }

  const value = decryptSecret(secret.ciphertext, secret.iv);
  return {
    id: secret.id,
    name: secret.name,
    description: secret.description,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    value,
  };
}

export async function updateSecret(
  userId: string,
  id: string,
  input: SecretUpdateInput
): Promise<SecretSummary> {
  const existing = await getSecretRecord(id);
  if (!existing || existing.userId !== userId) {
    throw new Error("Secret not found");
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    data.name = normalizeInputName(input.name);
  }

  if (input.description !== undefined) {
    data.description = normalizeDescription(input.description);
  }

  if (input.value !== undefined) {
    if (!input.value.length) {
      throw new Error("Value is required");
    }
    const { ciphertext, iv } = encryptSecret(input.value);
    data.ciphertext = ciphertext;
    data.iv = iv;
  }

  if (Object.keys(data).length === 0) {
    return {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  try {
    return await prisma.secret.update({
      where: { id },
      data,
      select: summarySelect,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("A secret with this name already exists");
    }
    throw err;
  }
}

export async function deleteSecret(userId: string, id: string): Promise<void> {
  const existing = await getSecretRecord(id);
  if (!existing || existing.userId !== userId) {
    throw new Error("Secret not found");
  }

  await prisma.secret.delete({ where: { id } });
}
