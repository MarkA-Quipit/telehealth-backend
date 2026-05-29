import bcrypt from "bcryptjs";
import { AppError } from "../../shared/types";
import { usersRepository } from "./users.repository";
import { uploadAvatarBuffer } from "../../config/cloudinary";
import type { UpdateUserInput } from "./users.schema";

export const usersService = {
  // ── getUserById ───────────────────────────────────────────────────────────
  async getUserById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  // ── updateUser ────────────────────────────────────────────────────────────
  async updateUser(requesterId: string, targetId: string, data: Partial<UpdateUserInput>) {
    if (requesterId !== targetId) {
      throw new AppError("You are not allowed to update another user's profile", 403);
    }
    // Verify user exists
    const existing = await usersRepository.findById(targetId);
    if (!existing) throw new AppError("User not found", 404);

    return usersRepository.updateById(targetId, data);
  },

  // ── changePassword ────────────────────────────────────────────────────────
  async changePassword(requesterId: string, userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (requesterId !== userId) throw new AppError("Forbidden", 403);

    const hash = await usersRepository.findPasswordHash(userId);
    if (!hash) throw new AppError("User not found", 404);

    const isValid = await bcrypt.compare(currentPassword, hash);
    if (!isValid) throw new AppError("Current password is incorrect", 400);

    if (newPassword === currentPassword) {
      throw new AppError("New password must be different from current password", 400);
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await usersRepository.updatePasswordHash(userId, newHash);
  },

  // ── uploadAvatar ──────────────────────────────────────────────────────────
  async uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string) {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new AppError("User not found", 404);

    const secureUrl = await uploadAvatarBuffer(userId, fileBuffer, mimeType);
    return usersRepository.updateAvatar(userId, secureUrl);
  },
};