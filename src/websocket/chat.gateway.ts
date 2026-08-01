import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import {
  EVENTOS_CHAT,
  barramentoChat,
  type EventoChat,
  type NomeEventoChat,
} from '../eventos/barramento-chat.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { CriptografiaService } from '../services/criptografia.service.js';
import type { TokenTenantService } from '../services/token-tenant.service.js';

interface IdentidadeSocket {
  usuarioId: string;
  email: string;
  tenantId: string;
  papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
  prisma: Awaited<ReturnType<GerenciadorConexoesTenant['obter']>>;
}

export class ChatGateway {
  private readonly io: Server;
  private readonly publicadores = new Map<NomeEventoChat, (evento: EventoChat) => void>();
  private readonly pub: Redis;
  private readonly sub: Redis;

  public constructor(
    servidor: HttpServer,
    redis: Redis,
    private readonly tokens: TokenTenantService,
    private readonly tenants: TenantCentralRepository,
    private readonly criptografia: CriptografiaService,
    private readonly conexoes: GerenciadorConexoesTenant,
    origens: readonly string[],
  ) {
    this.pub = redis.duplicate({ connectionName: 'socket-pub' });
    this.sub = redis.duplicate({ connectionName: 'socket-sub' });
    this.io = new Server(servidor, {
      cors: { origin: [...origens], credentials: true },
      path: '/socket.io',
    });
    this.io.adapter(createAdapter(this.pub, this.sub));
    this.io.use((socket, proximo) => {
      void this.autenticar(socket)
        .then(() => {
          proximo();
        })
        .catch(() => {
          proximo(new Error('NAO_AUTENTICADO'));
        });
    });
    this.io.on('connection', (socket) => {
      void this.conectar(socket);
    });
    for (const nome of EVENTOS_CHAT) {
      const publicador = (evento: EventoChat) => {
        this.publicar(nome, evento);
      };
      this.publicadores.set(nome, publicador);
      barramentoChat.on(nome, publicador);
    }
  }

  public async close(): Promise<void> {
    for (const [nome, publicador] of this.publicadores) barramentoChat.off(nome, publicador);
    await this.io.close();
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }

  private async autenticar(socket: Socket): Promise<void> {
    const tokenAuth = (socket.handshake.auth as Record<string, unknown>).token;
    const cabecalho = socket.handshake.headers.authorization;
    const token = typeof tokenAuth === 'string' ? tokenAuth : cabecalho?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Token ausente');
    const payload = this.tokens.verificar(token);
    const tenant = await this.tenants.buscarAtivoDoUsuario(payload.email, payload.tenantId);
    if (!tenant?.string_conexao_encrypted) throw new Error('Tenant indisponível');
    (socket.data as { identidade?: IdentidadeSocket }).identidade = {
      usuarioId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      papel: payload.papel,
      prisma: await this.conexoes.obter(
        tenant.id,
        this.criptografia.descriptografar(tenant.string_conexao_encrypted),
      ),
    } satisfies IdentidadeSocket;
  }

  private async conectar(socket: Socket): Promise<void> {
    const identidade = (socket.data as { identidade: IdentidadeSocket }).identidade;
    socket.on(
      'conversa:entrar',
      (conversaId: unknown, confirmar?: (resultado: { ok: boolean }) => void) => {
        void this.entrarConversa(socket, identidade, conversaId).then((ok) => confirmar?.({ ok }));
      },
    );
    await socket.join(this.roomTenant(identidade.tenantId));
    if (identidade.papel !== 'ATENDENTE') await socket.join(this.roomGestao(identidade.tenantId));
    const setores = await identidade.prisma.setor.findMany({
      where:
        identidade.papel === 'ATENDENTE'
          ? {
              atendentes: {
                some: {
                  atendente: {
                    usuario: {
                      usuario_central_public_id: identidade.usuarioId,
                      ativo: true,
                      deletado_at: null,
                    },
                  },
                },
              },
            }
          : { ativo: true, deletado_at: null },
      select: { public_id: true },
    });
    for (const setor of setores)
      await socket.join(this.roomSetor(identidade.tenantId, setor.public_id));
    const atualizarPresenca = () => void this.atualizarPresenca(socket, identidade);
    atualizarPresenca();
    const intervalo = setInterval(atualizarPresenca, 30_000);
    intervalo.unref();
    socket.on('disconnect', () => {
      clearInterval(intervalo);
      void this.registrarDesconexao(identidade, socket.id);
    });
  }

  private async entrarConversa(
    socket: Socket,
    identidade: IdentidadeSocket,
    conversaId: unknown,
  ): Promise<boolean> {
    if (typeof conversaId !== 'string') return false;
    const conversa = await identidade.prisma.conversa.findFirst({
      where: {
        public_id: conversaId,
        ...(identidade.papel === 'ATENDENTE'
          ? {
              setor: {
                atendentes: {
                  some: {
                    atendente: {
                      usuario: {
                        usuario_central_public_id: identidade.usuarioId,
                        ativo: true,
                        deletado_at: null,
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: { public_id: true },
    });
    if (!conversa) return false;
    await socket.join(this.roomConversa(identidade.tenantId, conversa.public_id));
    return true;
  }

  private async atualizarPresenca(socket: Socket, identidade: IdentidadeSocket): Promise<void> {
    await this.pub.set(this.chavePresenca(identidade, socket.id), '1', 'EX', 75);
    this.io.to(this.roomTenant(identidade.tenantId)).emit('atendente:presenca', {
      usuarioId: identidade.usuarioId,
      online: true,
      socketId: socket.id,
    });
  }

  private async registrarDesconexao(identidade: IdentidadeSocket, socketId: string): Promise<void> {
    await this.pub.del(this.chavePresenca(identidade, socketId));
    let cursor = '0';
    let online = false;
    do {
      const [proximo, chaves] = await this.pub.scan(
        cursor,
        'MATCH',
        `tenant:${identidade.tenantId}:presenca:${identidade.usuarioId}:*`,
        'COUNT',
        20,
      );
      cursor = proximo;
      if (chaves.length > 0) online = true;
    } while (cursor !== '0' && !online);
    this.io.to(this.roomTenant(identidade.tenantId)).emit('atendente:presenca', {
      usuarioId: identidade.usuarioId,
      online,
      socketId,
    });
  }

  private publicar(nome: NomeEventoChat, evento: EventoChat): void {
    this.io
      .to(this.roomConversa(evento.tenantId, evento.conversaId))
      .to(this.roomGestao(evento.tenantId))
      .emit(nome, evento);
    if (evento.setorId)
      this.io.to(this.roomSetor(evento.tenantId, evento.setorId)).emit(nome, evento);
  }
  private roomTenant(tenantId: string) {
    return `tenant:${tenantId}`;
  }
  private roomSetor(tenantId: string, setorId: string) {
    return `tenant:${tenantId}:setor:${setorId}`;
  }
  private roomGestao(tenantId: string) {
    return `tenant:${tenantId}:gestao`;
  }
  private roomConversa(tenantId: string, conversaId: string) {
    return `tenant:${tenantId}:conversa:${conversaId}`;
  }
  private chavePresenca(identidade: IdentidadeSocket, socketId: string) {
    return `tenant:${identidade.tenantId}:presenca:${identidade.usuarioId}:${socketId}`;
  }
}
