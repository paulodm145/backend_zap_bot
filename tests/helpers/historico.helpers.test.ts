import { describe, expect, it } from 'vitest';
import {
  codificarCursorTemporal,
  decodificarCursorTemporal,
} from '../../src/helpers/cursor-temporal.helper.js';
import { converterTimestampUnixWhatsapp } from '../../src/helpers/timestamp-whatsapp.helper.js';

describe('helpers do histórico', () => {
  it('converte timestamp Unix válido do WhatsApp', () => {
    expect(converterTimestampUnixWhatsapp('1785585600')?.toISOString()).toBe(
      '2026-08-01T12:00:00.000Z',
    );
  });

  it.each(['texto', '0', '-1', '9007199254740992'])(
    'rejeita timestamp inválido: %s',
    (timestamp) => {
      expect(converterTimestampUnixWhatsapp(timestamp)).toBeNull();
    },
  );

  it('codifica e decodifica cursor temporal', () => {
    const cursor = { ocorreuAt: new Date('2026-08-01T12:00:00.000Z'), id: 42 };
    expect(decodificarCursorTemporal(codificarCursorTemporal(cursor))).toEqual(cursor);
  });

  it.each([
    Buffer.from('data-invalida|1').toString('base64url'),
    Buffer.from('2026-08-01T12:00:00.000Z|0').toString('base64url'),
    Buffer.from('2026-08-01T12:00:00.000Z|1|extra').toString('base64url'),
  ])('rejeita cursor temporal inválido', (cursor) => {
    expect(decodificarCursorTemporal(cursor)).toBeNull();
  });
});
