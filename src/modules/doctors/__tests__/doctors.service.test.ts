import { doctorsService } from '../doctors.service';
import { doctorsRepository } from '../doctors.repository';
import { patientsService } from '../../patients/patients.service';
import { AppError } from '../../../shared/types';

jest.mock('../doctors.repository');
jest.mock('../../patients/patients.service');
jest.mock('../../../config/db', () => ({
  db: {
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

const mockDocRepo = doctorsRepository as jest.Mocked<typeof doctorsRepository>;
const mockPatientsService = patientsService as jest.Mocked<typeof patientsService>;

const mockDoctor = { id: 'doctor-1', userId: 'user-doctor', firstName: 'Dr', lastName: 'Smith', specialization: 'Cardiology' };
const mockPatient = { id: 'patient-1', userId: 'user-patient' };

describe('doctorsService.setAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(403) when requester is not the doctor', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    await expect(
      doctorsService.setAvailability('user-other', 'doctor-1', {
        availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true, slotDurationMinutes: 30 }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(400) when endTime <= startTime', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    await expect(
      doctorsService.setAvailability('user-doctor', 'doctor-1', {
        availability: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00', isAvailable: true, slotDurationMinutes: 30 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('calls repository when valid', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    mockDocRepo.setAvailability.mockResolvedValue([] as never);

    await doctorsService.setAvailability('user-doctor', 'doctor-1', {
      availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true, slotDurationMinutes: 30 }],
    });
    expect(mockDocRepo.setAvailability).toHaveBeenCalled();
  });
});

describe('doctorsService.addBlockedSlot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(400) when blockedDate is in the past', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    await expect(
      doctorsService.addBlockedSlot('user-doctor', 'doctor-1', {
        blockedDate: '2020-01-01',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(400) when endTime <= startTime', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await expect(
      doctorsService.addBlockedSlot('user-doctor', 'doctor-1', {
        blockedDate: tomorrow,
        startTime: '17:00',
        endTime: '09:00',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(403) when requester is not the doctor', async () => {
    mockDocRepo.findById.mockResolvedValue({ ...mockDoctor, userId: 'user-doctor' } as never);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await expect(
      doctorsService.addBlockedSlot('user-other', 'doctor-1', {
        blockedDate: tomorrow,
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('doctorsService.addReview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(400) when appointment is not completed', async () => {
    mockPatientsService.getPatientProfileByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findAppointmentForReview.mockResolvedValue({
      id: 'appt-1',
      status: 'pending',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
    } as never);

    await expect(
      doctorsService.addReview('user-patient', 'doctor-1', {
        appointmentId: 'appt-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(409) when a review already exists', async () => {
    mockPatientsService.getPatientProfileByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findAppointmentForReview.mockResolvedValue({
      id: 'appt-1',
      status: 'completed',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
    } as never);
    mockDocRepo.findReviewByAppointment.mockResolvedValue({ id: 'review-1' } as never);

    await expect(
      doctorsService.addReview('user-patient', 'doctor-1', {
        appointmentId: 'appt-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('doctorsService.listDoctors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clamps page to minimum 1', async () => {
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);
    const result = await doctorsService.listDoctors({ page: 0 });
    expect(result.page).toBe(1);
  });

  it('clamps limit to maximum 50', async () => {
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);
    const result = await doctorsService.listDoctors({ limit: 100 });
    expect(result.limit).toBe(50);
  });
});
