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

  // ── uploadAvatar ──────────────────────────────────────────────────────────
  async uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string) {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw new AppError("User not found", 404);

    const secureUrl = await uploadAvatarBuffer(userId, fileBuffer, mimeType);
    return usersRepository.updateAvatar(userId, secureUrl);
  },
};