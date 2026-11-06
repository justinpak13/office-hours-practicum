import { RedisService } from './redis.module';

describe('RedisService.withLock', () => {
  let service: RedisService;
  let fakeDb: { set: jest.Mock; eval: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    service = new RedisService();
    fakeDb = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue(1),
      disconnect: jest.fn(),
    };
    (service as any).clients.db = fakeDb;
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('runs work and releases the lock with the same token when acquired', async () => {
    fakeDb.set.mockResolvedValue('OK');
    const work = jest.fn().mockResolvedValue(undefined);

    const result = await service.withLock('locks:test', 1000, work);

    expect(result).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
    const token = fakeDb.set.mock.calls[0][1];
    expect(fakeDb.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('del', KEYS[1])"),
      1,
      'locks:test',
      token,
    );
  });

  it('skips work and release when the lock is held elsewhere', async () => {
    fakeDb.set.mockResolvedValue(null);
    const work = jest.fn();

    const result = await service.withLock('locks:test', 1000, work);

    expect(result).toBe(false);
    expect(work).not.toHaveBeenCalled();
    expect(fakeDb.eval).not.toHaveBeenCalled();
  });

  it('releases the lock and rethrows when work fails', async () => {
    fakeDb.set.mockResolvedValue('OK');
    const error = new Error('boom');

    await expect(
      service.withLock('locks:test', 1000, () => Promise.reject(error)),
    ).rejects.toBe(error);
    expect(fakeDb.eval).toHaveBeenCalledTimes(1);
  });

  it('rethrows the work error when the release also fails', async () => {
    fakeDb.set.mockResolvedValue('OK');
    fakeDb.eval.mockRejectedValue(new Error('redis down'));
    const error = new Error('boom');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.withLock('locks:test', 1000, () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('sets the key only if absent with a millisecond expiry', async () => {
    fakeDb.set.mockResolvedValue('OK');

    await service.withLock('locks:test', 1234, async () => undefined);

    expect(fakeDb.set).toHaveBeenCalledWith(
      'locks:test',
      expect.any(String),
      'PX',
      1234,
      'NX',
    );
  });
});
