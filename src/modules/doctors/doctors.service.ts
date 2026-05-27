import { AppError } from "../../shared/types";
import { doctorsRepository } from "./doctors.repository";
import type { UpdateDoctorInput, SetAvailabilityInput, BlockSlotInput } from "./doctors.schema";

export const doctorsService = {
  // ── listDoctors ───────────────────────────────────────────────────────────
  async listDoctors(filters: {
    specialization?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));

    const { items, total } = await doctorsRepository.findAll({
      specialization: filters.specialization,
      search: filters.search,
      page,
      limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // ── getDoctorById ─────────────────────────────────────────────────────────
  async getDoctorById(doctorId: string) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    return doctor;
  },

  // ── updateDoctorProfile ───────────────────────────────────────────────────
  async updateDoctorProfile(requesterId: string, doctorId: string, data: Partial<UpdateDoctorInput>) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);

    if (doctor.userId !== requesterId) {
      throw new AppError("You are not allowed to update this doctor profile", 403);
    }

    const updated = await doctorsRepository.update(doctorId, data);
    // Return the full profile with user data
    return doctorsRepository.findById(updated.id);
  },

  // ── getAvailableSlots ─────────────────────────────────────────────────────
  async getAvailableSlots(doctorId: string, date: string) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    return doctorsRepository.getAvailableSlots(doctorId, date);
  },

  // ── getAvailability ───────────────────────────────────────────────────────
  async getAvailability(doctorId: string) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    return doctorsRepository.getAvailability(doctorId);
  },

  // ── setAvailability ───────────────────────────────────────────────────────
  async setAvailability(
    requesterId: string,
    doctorId: string,
    input: SetAvailabilityInput,
  ) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    if (doctor.userId !== requesterId) {
      throw new AppError("You are not allowed to update this doctor's availability", 403);
    }

    // Validate endTime > startTime for each slot
    for (const slot of input.availability) {
      const [sh, sm] = slot.startTime.split(":").map(Number);
      const [eh, em] = slot.endTime.split(":").map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        throw new AppError(
          `endTime must be after startTime for day ${slot.dayOfWeek}`,
          400,
        );
      }
    }

    return doctorsRepository.setAvailability(doctorId, input.availability);
  },

  // ── getBlockedSlots ───────────────────────────────────────────────────────
  async getBlockedSlots(requesterId: string, doctorId: string) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    // Any authenticated user can view blocked slots (needed for booking flow)
    void requesterId;
    return doctorsRepository.getBlockedSlots(doctorId);
  },

  // ── addBlockedSlot ────────────────────────────────────────────────────────
  async addBlockedSlot(
    requesterId: string,
    doctorId: string,
    data: BlockSlotInput,
  ) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    if (doctor.userId !== requesterId) {
      throw new AppError("You are not allowed to add blocked slots for this doctor", 403);
    }

    // Validate blockedDate is not in the past
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const slotDate = new Date(`${data.blockedDate}T00:00:00.000Z`);
    if (slotDate < today) {
      throw new AppError("Cannot block a date in the past", 400);
    }

    // Validate endTime > startTime
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = data.endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      throw new AppError("endTime must be after startTime", 400);
    }

    return doctorsRepository.addBlockedSlot(doctorId, data);
  },

  // ── deleteBlockedSlot ─────────────────────────────────────────────────────
  async deleteBlockedSlot(
    requesterId: string,
    doctorId: string,
    slotId: string,
  ) {
    const doctor = await doctorsRepository.findById(doctorId);
    if (!doctor) throw new AppError("Doctor not found", 404);
    if (doctor.userId !== requesterId) {
      throw new AppError("You are not allowed to delete blocked slots for this doctor", 403);
    }
    await doctorsRepository.deleteBlockedSlot(slotId);
  },
};