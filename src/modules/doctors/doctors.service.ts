import { AppError } from "../../shared/types";
import { doctorsRepository } from "./doctors.repository";
import type { UpdateDoctorInput } from "./doctors.schema";

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
};