import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { savePhotoBuffer } from './photos';

// sharp's types declare a default export, but its CJS build exports the
// function itself, and this tsconfig has no esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

describe('savePhotoBuffer', () => {
  let dir: string;
  const oldUploadLocation = process.env.UPLOAD_LOCATION;

  const png = (width: number, height: number) =>
    sharp({
      create: { width, height, channels: 3, background: '#3366cc' },
    })
      .png()
      .toBuffer();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-spec-'));
    process.env.UPLOAD_LOCATION = dir;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (oldUploadLocation === undefined) {
      delete process.env.UPLOAD_LOCATION;
    } else {
      process.env.UPLOAD_LOCATION = oldUploadLocation;
    }
  });

  it('downscales wide images to 512px JPEG', async () => {
    await savePhotoBuffer(await png(1024, 600), 'wide.jpg');
    const meta = await sharp(path.join(dir, 'wide.jpg')).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(512);
  });

  it('does not enlarge small images', async () => {
    await savePhotoBuffer(await png(200, 100), 'small.jpg');
    const meta = await sharp(path.join(dir, 'small.jpg')).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(200);
  });

  it('rejects non-image input', async () => {
    await expect(
      savePhotoBuffer(Buffer.from('<html>not an image</html>'), 'bad.jpg'),
    ).rejects.toThrow(/unsupported image format/);
    expect(fs.existsSync(path.join(dir, 'bad.jpg'))).toBe(false);
  });
});
