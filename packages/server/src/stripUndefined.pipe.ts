import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * Strip undefined properties from body.
 */
@Injectable()
export class StripUndefinedPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.dropUndefined(value);
  }

  private dropUndefined(value: unknown): unknown {
    // Nothing to strip from undefined, null, strings, numbers, etc.
    if (value === null || typeof value !== 'object') {
      return value;
    }
    for (const key of Object.keys(value)) {
      if ((value as Record<string, unknown>)[key] === undefined) {
        delete (value as Record<string, unknown>)[key];
      }
    }
    return value;
  }
}
