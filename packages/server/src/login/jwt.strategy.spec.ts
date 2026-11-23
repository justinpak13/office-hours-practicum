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

  beforeEach(() => {
    jest.resetAllMocks();
    oidcTokenService.verify.mockResolvedValue({ sub: 's' });
    oidcUserService.findOrCreate.mockResolvedValue(user);
  });

  it('starts the sync for the resolved user and returns without awaiting it', async () => {
    sync.syncIfDue.mockReturnValue(new Promise(() => undefined)); // never settles
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    expect(sync.syncIfDue).toHaveBeenCalledWith(user);
  });

  it('a rejected sync does not fail validate', async () => {
    sync.syncIfDue.mockRejectedValue(new Error('boom'));
    await expect(strategy.validate(req)).resolves.toEqual({ userId: 7 });
    await new Promise((r) => setImmediate(r)); // let the catch run
  });
});
