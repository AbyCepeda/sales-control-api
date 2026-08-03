import { hashPassword } from "@/lib/bcrypt";
import { prisma } from "@/lib/prisma";
import type {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from "./user.dto";
import type { SafeUser } from "./user.types";

function toSafeUser(user: SafeUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUsersService(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return users.map(toSafeUser);
}

export async function createUserService(data: CreateUserDto): Promise<SafeUser> {
  const email = data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error("Ya existe un usuario con ese email");
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      password: hashedPassword,
      role: data.role,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toSafeUser(user);
}

export async function updateUserService(
  userId: number,
  data: UpdateUserDto,
): Promise<SafeUser> {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new Error("Usuario no encontrado");
  }

  const email = data.email?.toLowerCase();

  if (email && email !== existingUser.email) {
    const emailInUse = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (emailInUse) {
      throw new Error("Ya existe un usuario con ese email");
    }
  }

  const hashedPassword = data.password
    ? await hashPassword(data.password)
    : undefined;

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: data.name,
      email,
      password: hashedPassword,
      role: data.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toSafeUser(user);
}

export async function updateUserStatusService(
  userId: number,
  data: UpdateUserStatusDto,
): Promise<SafeUser> {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new Error("Usuario no encontrado");
  }

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      isActive: data.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toSafeUser(user);
}