import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp = require('jimp');

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_WIDTH = 512;

export function uploadDir(): string {
  const dir =
    process.env.UPLOAD_LOCATION || path.join(process.cwd(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function khouryPhotoFileName(userId: number): string {
  return `u${userId}-khoury.jpg`;
}

export function customPhotoFileName(userId: number): string {
  return (
    `u${userId}-custom-` + Math.random().toString(36).substring(2, 15) + '.jpg'
  );
}

// Custom (user-uploaded) photos always win over Khoury-synced ones
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
 * Decode, downscale to <=512px wide, and re-encode as JPEG (which also
 * strips EXIF metadata from uploads). Throws if the buffer is not a
 * decodable image, e.g. an error page from the photo service.
 */
export async function savePhotoBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<void> {
  const image = await Jimp.read(buffer);
  if (image.getWidth() > MAX_PHOTO_WIDTH) {
    image.resize(MAX_PHOTO_WIDTH, Jimp.AUTO);
  }
  await image.quality(85).writeAsync(path.join(uploadDir(), fileName));
}

/**
 * Download a URL to a Buffer with a timeout, size cap, and redirect
 * following. Used for the expiring Khoury photo-service URLs.
 */
export function fetchPhoto(url: string, redirectsLeft = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects fetching photo'));
        } else {
          resolve(fetchPhoto(res.headers.location, redirectsLeft - 1));
        }
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Photo fetch failed with status ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_PHOTO_BYTES) {
          req.destroy(new Error('Photo response too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Photo fetch timed out')));
    req.on('error', reject);
  });
}
