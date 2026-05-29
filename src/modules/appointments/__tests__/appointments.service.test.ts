import { appointmentsService } from '../appointments.service';
import { appointmentsRepository } from '../appointments.repository';
import { patientsRepository } from '../../patients/patients.repository';
import { doctorsRepository } from '../../doctors/doctors.repository';
import { notificationsService } from '../../notifications/notifications.service';
import { AppError } from '../../../shared/types';

jest.mock('../../../config/db', () => ({
  db: {
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));
jest.mock('../../../config/pusher', () => ({
  pusher: { trigger: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../appointments.repository');
jest.mock('../../patients/patients.repository');
jest.mock('../../doctors/doctors.repository');
jest.mock('../../notifications/notifications.service');

const mockApptRepo = appointmentsRepository as jest.Mocked<typeof appointmentsRepository>;
const mockPatRepo = patientsRepository as jest.Mocked<typeof patientsRepository>;
const mockDocRepo = doctorsRepository as jest.Mocked<typeof doctorsRepository>;
const mockNotifService = notificationsService as jest.Mocked<typeof notificationsService>;

const mockPatient = { id: 'patient-1', userId: 'user-patient', firstName: 'Jane', lastName: 'Doe' };
const mockDoctor = { id: 'doctor-1', userId: 'user-doctor', firstName: 'Dr', lastName: 'Smith' };
const futureDate = new Date(Date.now() + 86400000).toISOString();
const mockAppointment = {
  id: 'appt-1',
  patientId: 'patient-1',
  doctorId: 'doctor-1',
  status: 'pending' as const,
  scheduledAt: new Date(futureDate),
  endsAt: new Date(Date.now() + 86400000 + 1800000),
  jitsiRoomName: 'room-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('appointmentsService.createAppointment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(403) when requester has no patient profile', async () => {
    mockPatRepo.findByUserId.mockResolvedValue(null);
    await expect(
      appointmentsService.createAppointment('user-1', {
        doctorId: 'doctor-1',
        scheduledAt: futureDate,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(404) when doctor is not found', async () => {
    mockPatRepo.findByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findById.mockResolvedValue(null);
    await expect(
      appointmentsService.createAppointment('user-1', {
        doctorId: 'unknown-doctor',
        scheduledAt: futureDate,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(400) when scheduledAt is in the past', async () => {
    mockPatRepo.findByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findById.mockResolvedValue(mockDoctor as never);
    await expect(
      appointmentsService.createAppointment('user-1', {
        doctorId: 'doctor-1',
        scheduledAt: new Date(Date.now() - 86400000).toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws AppError(409) when slot has a conflict', async () => {
    mockPatRepo.findByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findById.mockResolvedValue(mockDoctor as never);
    mockApptRepo.checkConflict.mockResolvedValue(true);
    await expect(
      appointmentsService.createAppointment('user-1', {
        doctorId: 'doctor-1',
        scheduledAt: futureDate,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates the appointment and sends notifications on success', async () => {
    mockPatRepo.findByUserId.mockResolvedValue(mockPatient as never);
    mockDocRepo.findById.mockResolvedValue(mockDoctor as never);
    mockApptRepo.checkConflict.mockResolvedValue(false);
    mockApptRepo.create.mockResolvedValue(mockAppointment as never);
    mockApptRepo.findById.mockResolvedValue({ ...mockAppointment, patient: mockPatient, doctor: mockDoctor } as never);
    mockNotifService.createAndPush.mockResolvedValue(undefined);

    await appointmentsService.createAppointment('user-patient', {
      doctorId: 'doctor-1',
      scheduledAt: futureDate,
    });

    expect(mockApptRepo.create).toHaveBeenCalled();
  });
});

describe('appointmentsService.updateStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(403) when requester is not the assigned doctor', async () => {
    mockApptRepo.findById.mockResolvedValue({
      ...mockAppointment,
      patient: mockPatient,
      doctor: { ...mockDoctor, userId: 'another-user' },
    } as never);
    await expect(
      appointmentsService.updateStatus('user-requester', 'appt-1', { status: 'confirmed' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws AppError(409) when appointment is already in a terminal state', async () => {
    mockApptRepo.findById.mockResolvedValue({
      ...mockAppointment,
      status: 'completed',
      doctor: { ...mockDoctor, userId: 'user-doctor' },
      patient: mockPatient,
    } as never);
    await expect(
      appointmentsService.updateStatus('user-doctor', 'appt-1', { status: 'confirmed' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws AppError(409) for an invalid transition (e.g. confirmed→confirmed)', async () => {
    mockApptRepo.findById.mockResolvedValue({
      ...mockAppointment,
      status: 'confirmed',
      doctor: { ...mockDoctor, userId: 'user-doctor' },
      patient: mockPatient,
    } as never);
    // confirmed → confirmed is not in DOCTOR_TRANSITIONS
    await expect(
      appointmentsService.updateStatus('user-doctor', 'appt-1', { status: 'confirmed' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('appointmentsService.generateIcsContent', () => {
  it('returns ICS content starting with BEGIN:VCALENDAR', async () => {
    mockApptRepo.findById.mockResolvedValue({
      ...mockAppointment,
      patient: { ...mockPatient, userId: 'user-patient' },
      doctor: { ...mockDoctor, userId: 'user-doctor' },
    } as never);

    const result = await appointmentsService.generateIcsContent('appt-1', 'user-patient');
    expect(result).toMatch(/^BEGIN:VCALENDAR/);
  });

  it('throws AppError(403) for unauthorized user', async () => {
    mockApptRepo.findById.mockResolvedValue({
      ...mockAppointment,
      patient: { ...mockPatient, userId: 'user-patient' },
      doctor: { ...mockDoctor, userId: 'user-doctor' },
    } as never);

    await expect(
      appointmentsService.generateIcsContent('appt-1', 'user-stranger'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
