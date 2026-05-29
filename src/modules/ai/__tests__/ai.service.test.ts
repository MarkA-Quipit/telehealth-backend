import { aiService } from '../ai.service';
import { doctorsRepository } from '../../doctors/doctors.repository';
import { groqClient } from '../../../config/groq';

jest.mock('../../doctors/doctors.repository');
jest.mock('../../../config/groq', () => ({
  groqClient: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
  GROQ_MODEL: 'test-model',
}));
jest.mock('../../../config/db', () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        catch: jest.fn(),
      }),
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

const mockDocRepo = doctorsRepository as jest.Mocked<typeof doctorsRepository>;
const mockGroq = groqClient as jest.Mocked<typeof groqClient>;

describe('aiService.getRecommendations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls getDistinctSpecializations to build the prompt', async () => {
    mockDocRepo.getDistinctSpecializations.mockResolvedValue(['Cardiology', 'Dermatology']);
    (mockGroq.chat.completions.create as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        recommendations: [{ specialization: 'Cardiology', reason: 'Heart symptoms' }],
      }) } }],
    });
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);

    await aiService.getRecommendations('chest pain', 'user-1');
    expect(mockDocRepo.getDistinctSpecializations).toHaveBeenCalled();
  });

  it('falls back to General Practitioner when Groq API throws', async () => {
    mockDocRepo.getDistinctSpecializations.mockResolvedValue(['Cardiology']);
    (mockGroq.chat.completions.create as jest.Mock).mockRejectedValue(new Error('API error'));
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);

    const result = await aiService.getRecommendations('unclear symptoms', 'user-1');
    expect(result.recommendations[0].specialization).toBe('General Practitioner');
  });

  it('falls back to General Practitioner on malformed JSON response', async () => {
    mockDocRepo.getDistinctSpecializations.mockResolvedValue(['Cardiology']);
    (mockGroq.chat.completions.create as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
    });
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);

    const result = await aiService.getRecommendations('unclear symptoms', 'user-1');
    expect(result.recommendations[0].specialization).toBe('General Practitioner');
  });

  it('fetches matching doctors for each recommendation', async () => {
    const mockDoctor = { id: 'doc-1', firstName: 'Jane', specialization: 'Cardiology' };
    mockDocRepo.getDistinctSpecializations.mockResolvedValue(['Cardiology']);
    (mockGroq.chat.completions.create as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        recommendations: [{ specialization: 'Cardiology', reason: 'Heart symptoms' }],
      }) } }],
    });
    mockDocRepo.findAll.mockResolvedValue({ items: [mockDoctor], total: 1 } as never);

    const result = await aiService.getRecommendations('chest pain', 'user-1');
    expect(result.recommendations[0].doctors).toHaveLength(1);
    expect(mockDocRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ specialization: 'Cardiology', page: 1, limit: 3 }),
    );
  });
});

describe('aiService.streamRecommendations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('yields token chunks then a done chunk', async () => {
    mockDocRepo.getDistinctSpecializations.mockResolvedValue(['Cardiology']);
    mockDocRepo.findAll.mockResolvedValue({ items: [], total: 0 } as never);

    // Simulate a streaming response that sends tokens then finishes
    const fakeStream = (async function* () {
      yield { choices: [{ delta: { content: '{"recommendations"' } }] };
      yield { choices: [{ delta: { content: ':[{"specialization":"Cardiology","reason":"Test"}]}' } }] };
    })();

    (mockGroq.chat.completions.create as jest.Mock).mockResolvedValue(fakeStream);

    const chunks: object[] = [];
    for await (const chunk of aiService.streamRecommendations('chest pain', 'user-1')) {
      chunks.push(chunk);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenChunks = chunks.filter((c: any) => c.type === 'token');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doneChunks = chunks.filter((c: any) => c.type === 'done');
    expect(tokenChunks.length).toBeGreaterThan(0);
    expect(doneChunks).toHaveLength(1);
  });
});
