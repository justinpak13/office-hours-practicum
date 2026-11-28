import * as fs from 'fs';
import * as path from 'path';
// sharp's types declare a default export, but its CJS build exports the
// function itself, and this tsconfig has no esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

const MAX_PHOTO_WIDTH = 512;

export function uploadDir(): string {
  const dir =
    process.env.UPLOAD_LOCATION || path.join(process.cwd(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function customPhotoFileName(userId: number): string {
  return (
    `u${userId}-custom-` + Math.random().toString(36).substring(2, 15) + '.jpg'
  );
}

// Custom (user-uploaded) photos, as opposed to older Khoury-synced ones
export function isCustomPhoto(fileName: string): boolean {
  return fileName.includes('-custom-');
}

// Also guards the get_picture route param against path traversal
export function isSafePhotoFileName(fileName: string): boolean {
  return /^[\w.-]+$/.test(fileName);
}

export function deletePhotoFile(fileName: string): void {
  if (!fileName || !isSafePhotoFileName(fileName)) {
    return;
  }
  fs.unlink(path.join(uploadDir(), fileName), (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Error deleting photo file', fileName, err);
    }
  });
}

/**
 * Decode, apply EXIF orientation, downscale to <=512px wide, and re-encode
 * as JPEG (which also strips EXIF metadata from uploads). Throws if the
 * buffer is not a decodable image, e.g. an error page from the photo service.
 */
export async function savePhotoBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<void> {
  await sharp(buffer)
    .rotate() // apply EXIF orientation; output JPEG drops metadata
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(path.join(uploadDir(), fileName));
}
