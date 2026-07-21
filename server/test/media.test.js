import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processMedia, HttpError } from '../src/media.js';

const SETTINGS = { maxUploadMb: 25, allowedTypes: ['image', 'gif', 'video', 'audio'] };

describe('pipeline média', () => {
  it('rejette un fichier qui n\'est pas un média', async () => {
    await expect(processMedia(Buffer.from('ceci est du texte, pas une image'), SETTINGS))
      .rejects.toThrow(HttpError);
  });

  it('rejette un buffer vide', async () => {
    await expect(processMedia(Buffer.alloc(0), SETTINGS)).rejects.toThrow(/empty/i);
  });

  it('transcode une image PNG en webp et borne les dimensions', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
    const out = await processMedia(png, SETTINGS);
    expect(out.type).toBe('image');
    expect(out.mime).toBe('image/webp');
    expect(out.width).toBe(8);
    expect(out.relPath).toMatch(/\.webp$/);
  });

  it('refuse un type désactivé sur le channel', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processMedia(png, { ...SETTINGS, allowedTypes: ['audio'] })).rejects.toThrow(/disabled/i);
  });
});
