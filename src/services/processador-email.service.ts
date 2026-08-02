import type { JobEmail } from '../types/jobs.js';
import type { EnviadorEmail } from './enviador-email.service.js';
import type { TemplateEmailService } from './template-email.service.js';

export class ProcessadorEmailService {
  public constructor(
    private readonly templates: TemplateEmailService,
    private readonly enviador: EnviadorEmail,
  ) {}

  public async processar(job: JobEmail): Promise<void> {
    await this.enviador.enviar(this.templates.renderizar(job));
  }
}
