/**
 * Validação estática de URL de integração externa.
 *
 * Recusa o que nunca deve sair da plataforma: protocolo fora de HTTPS,
 * credencial embutida na própria URL e host que aponta de volta para a
 * infraestrutura (loopback, rede privada, link-local e o metadata das nuvens
 * em `169.254.169.254`).
 *
 * A checagem é puramente sintática e não resolve DNS: um domínio público que
 * resolva para IP privado só é detectável no momento da requisição. Essa
 * segunda barreira pertence ao cliente HTTP que executa a chamada, não a
 * este helper.
 */

export type MotivoUrlExternaInvalida =
  'FORMATO_INVALIDO' | 'PROTOCOLO_NAO_PERMITIDO' | 'CREDENCIAL_NA_URL' | 'HOST_PRIVADO';

export type ResultadoUrlExterna =
  { valida: true; url: URL } | { valida: false; motivo: MotivoUrlExternaInvalida };

export const MENSAGENS_URL_EXTERNA_INVALIDA: Record<MotivoUrlExternaInvalida, string> = {
  FORMATO_INVALIDO: 'Informe uma URL absoluta válida',
  PROTOCOLO_NAO_PERMITIDO: 'A URL deve usar HTTPS',
  CREDENCIAL_NA_URL: 'A URL não pode conter usuário ou senha',
  HOST_PRIVADO: 'A URL não pode apontar para host local ou rede privada',
};

const SUFIXOS_HOST_INTERNO = ['.local', '.localhost', '.internal', '.home.arpa'];
const HOSTS_INTERNOS = new Set(['localhost', 'ip6-localhost', 'ip6-loopback']);

export function validarUrlExterna(valor: string): ResultadoUrlExterna {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return { valida: false, motivo: 'FORMATO_INVALIDO' };
  }

  if (url.protocol !== 'https:') return { valida: false, motivo: 'PROTOCOLO_NAO_PERMITIDO' };
  if (url.username !== '' || url.password !== '')
    return { valida: false, motivo: 'CREDENCIAL_NA_URL' };
  if (hostInterno(url.hostname)) return { valida: false, motivo: 'HOST_PRIVADO' };

  return { valida: true, url };
}

/** Indica se o host é nome reservado, IPv4 privado/reservado ou IPv6 loopback/privado. */
export function hostInterno(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === '') return true;
  if (HOSTS_INTERNOS.has(host)) return true;
  if (SUFIXOS_HOST_INTERNO.some((sufixo) => host.endsWith(sufixo))) return true;

  const ipv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (ipv6.includes(':')) return ipv6PrivadoOuLoopback(ipv6);

  const octetos = ipv4Octetos(host);
  return octetos ? ipv4PrivadoOuReservado(octetos) : false;
}

function ipv4Octetos(host: string): number[] | null {
  const partes = host.split('.');
  if (partes.length !== 4) return null;
  const octetos: number[] = [];
  for (const parte of partes) {
    if (!/^\d{1,3}$/.test(parte)) return null;
    const numero = Number(parte);
    if (numero > 255) return null;
    octetos.push(numero);
  }
  return octetos;
}

function ipv4PrivadoOuReservado(octetos: number[]): boolean {
  const [primeiro = 0, segundo = 0] = octetos;
  if (primeiro === 10 || primeiro === 127 || primeiro === 0) return true;
  if (primeiro === 169 && segundo === 254) return true;
  if (primeiro === 172 && segundo >= 16 && segundo <= 31) return true;
  if (primeiro === 192 && segundo === 168) return true;
  if (primeiro >= 224) return true;
  return false;
}

function ipv6PrivadoOuLoopback(endereco: string): boolean {
  const normalizado = endereco.toLowerCase();
  if (normalizado === '::' || normalizado === '::1') return true;
  // fc00::/7 (únicos locais) e fe80::/10 (link-local).
  if (/^f[cd][0-9a-f]{0,2}:/.test(normalizado)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(normalizado)) return true;
  // IPv4 mapeado em IPv6 (::ffff:127.0.0.1) reaproveita a checagem IPv4.
  const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalizado);
  if (mapeado?.[1]) {
    const octetos = ipv4Octetos(mapeado[1]);
    return octetos ? ipv4PrivadoOuReservado(octetos) : false;
  }
  return false;
}
