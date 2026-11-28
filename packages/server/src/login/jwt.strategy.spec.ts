import { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy Khoury Admin sync hook', () => {
  const user = { id: 7 };
  const oidcTokenService = { verify: jest.fn() };
  const oidcUserService = { findOrCreate: jest.fn() };
  const sync = { syncIfDue: jest.fn() };
  const strategy = new JwtStrategy(
    oidcTokenService as any,
    oidcUserService as any,
    sync as any,
  );
  const req = {
    headers: { authorization: 'Bearer x' },
  } as Request;

  let error: jest.SpyInstance;
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.resetAllMocks();
    error = jest
      .spyOn((strategy as any).logger, 'error')
      .mockImplementation(() => undefined);
    oidcTokenService.verify.mockResolvedValue({ sub: 's' });
    oidcUserService.findOrCreate.mockResolvedValue(user);
  });

  it('starts the sync for the resolved user and returns without awaiting it', async () => {
    sync.syncIfDue.mockReturnValue(new Promise(() => undefined)); // never settles
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r));
    expect(sync.syncIfDue).toHaveBeenCalledWith(user);
  });

  it('a failed token verify does not start the sync', async () => {
    oidcTokenService.verify.mockRejectedValue(new Error('bad token'));
    await expect(strategy.validate(req)).rejects.toThrow('bad token');
    await new Promise((r) => setImmediate(r));
    expect(sync.syncIfDue).not.toHaveBeenCalled();
  });

  it('a failed findOrCreate does not start the sync', async () => {
    oidcUserService.findOrCreate.mockRejectedValue(new Error('db down'));
    await expect(strategy.validate(req)).rejects.toThrow('db down');
    await new Promise((r) => setImmediate(r));
    expect(sync.syncIfDue).not.toHaveBeenCalled();
  });

  it('a rejected sync does not fail validate', async () => {
    sync.syncIfDue.mockRejectedValue(new Error('boom'));
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r)); // let the catch run
  });

  it('a sync returning a non-promise does not fail validate', async () => {
    sync.syncIfDue.mockReturnValue(undefined);
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r));
  });

  it('a sync that throws synchronously does not fail validate', async () => {
    sync.syncIfDue.mockImplementation(() => {
      throw new Error('sync boom');
    });
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r));
  });

  it('logs exactly once per failed sync, and validate still resolves', async () => {
    const both = Object.assign(new Error('Khoury Admin A and B failed'), {
      errors: [
        Object.assign(new Error('Khoury Admin A failed'), {
          cause: new Error('a boom'),
        }),
        Object.assign(new Error('Khoury Admin B failed'), {
          cause: new Error('b boom'),
        }),
      ],
    });
    for (const rejection of [
      new Error('db down'),
      undefined,
      Object.create(null),
      both,
    ]) {
      error.mockClear();
      sync.syncIfDue.mockRejectedValue(rejection);
      await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
      await new Promise((r) => setImmediate(r));
      expect(error).toHaveBeenCalledTimes(1);
    }
    const text = error.mock.calls[0][0];
    for (const part of ['A failed', 'B failed', 'a boom', 'b boom']) {
      expect(text).toContain(part);
    }
  });

  it('logs stacks, never query parameters, and survives a throwing logger', async () => {
    const queryFailed = Object.assign(new Error('duplicate key'), {
      query: 'INSERT ...',
      parameters: ['secret@x.edu'],
      driverError: { detail: 'Key (email)=(secret@x.edu) exists' },
    });
    sync.syncIfDue.mockRejectedValue(
      Object.assign(new Error('Khoury Admin A failed'), { cause: queryFailed }),
    );
    await strategy.validate(req);
    await new Promise((r) => setImmediate(r));
    const text = error.mock.calls[0][0];
    expect(text).toContain('duplicate key');
    expect(text).toContain('at ');
    expect(text).not.toContain('secret@x.edu');

    error.mockImplementation(() => {
      throw new Error('logger down');
    });
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r));
  });
});
