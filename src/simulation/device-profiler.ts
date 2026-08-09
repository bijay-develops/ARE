import type { DeviceType } from '../core/types.js';

/** Classify a device from an explicit header or the User-Agent string. */
export function profileDevice(explicit: string | undefined, userAgent: string | undefined): DeviceType {
  if (explicit === 'mobile' || explicit === 'desktop') return explicit;
  return /mobi|android|iphone|ipad/i.test(userAgent ?? '') ? 'mobile' : 'desktop';
}
