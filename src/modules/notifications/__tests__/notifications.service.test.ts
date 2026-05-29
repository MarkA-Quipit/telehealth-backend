import { notificationsService } from '../notifications.service';
import { notificationsRepository } from '../notifications.repository';
import { pusher } from '../../../config/pusher';
import { AppError } from '../../../shared/types';

jest.mock('../notifications.repository');
jest.mock('../../../config/pusher', () => ({
  pusher: { trigger: jest.fn().mockResolvedValue(undefined) },
}));

const mockRepo = notificationsRepository as jest.Mocked<typeof notificationsRepository>;
const mockPusher = pusher as jest.Mocked<typeof pusher>;

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'appointment_booked' as const,
  title: 'Appointment Booked',
  message: 'Your appointment has been booked.',
  data: null,
  isRead: false,
  createdAt: new Date(),
};

describe('notificationsService.createAndPush', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the notification via the repository', async () => {
    mockRepo.create.mockResolvedValue(mockNotification);

    await notificationsService.createAndPush(
      'user-1',
      'appointment_booked',
      'Appointment Booked',
      'Your appointment has been booked.',
    );

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'appointment_booked',
      }),
    );
  });

  it('triggers Pusher on the correct user channel', async () => {
    mockRepo.create.mockResolvedValue(mockNotification);

    await notificationsService.createAndPush(
      'user-1',
      'appointment_booked',
      'Appointment Booked',
      'Your appointment has been booked.',
    );

    // Pusher trigger is fire-and-forget — allow microtasks to flush
    await Promise.resolve();
    expect(mockPusher.trigger).toHaveBeenCalledWith(
      'user-user-1',
      'appointment_booked',
      expect.objectContaining({ id: 'notif-1' }),
    );
  });
});

describe('notificationsService.deleteNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(404) when notification is not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      notificationsService.deleteNotification('user-1', 'notif-999'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws AppError(403) when notification belongs to a different user', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockNotification, userId: 'user-2' });
    await expect(
      notificationsService.deleteNotification('user-1', 'notif-1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('calls deleteById on success', async () => {
    mockRepo.findById.mockResolvedValue(mockNotification);
    mockRepo.deleteById.mockResolvedValue(undefined);

    await notificationsService.deleteNotification('user-1', 'notif-1');
    expect(mockRepo.deleteById).toHaveBeenCalledWith('notif-1');
  });
});

describe('notificationsService.getNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls findByUser and countUnread in parallel and returns combined result', async () => {
    mockRepo.findByUser.mockResolvedValue({ items: [mockNotification], total: 1 });
    mockRepo.countUnread.mockResolvedValue(1);

    const result = await notificationsService.getNotifications('user-1');

    expect(mockRepo.findByUser).toHaveBeenCalled();
    expect(mockRepo.countUnread).toHaveBeenCalled();
    expect(result).toMatchObject({
      items: [mockNotification],
      total: 1,
      unreadCount: 1,
    });
  });
});
