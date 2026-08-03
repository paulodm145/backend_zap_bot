import { catalogoBlocosFluxoSchema, type CatalogoBlocosFluxo } from '../dtos/fluxo.dto.js';

const PADRAO_IDENTIFICADOR = '^[A-Za-z][A-Za-z0-9_-]{0,63}$';
const PADRAO_VARIAVEL = '^[A-Za-z_][A-Za-z0-9_.]{0,79}$';

const catalogo: CatalogoBlocosFluxo = catalogoBlocosFluxoSchema.parse({
  schemaVersao: 1,
  restricoesGrafo: {
    maximoBlocos: 500,
    ciclosPermitidos: false,
    padraoIdentificador: PADRAO_IDENTIFICADOR,
  },
  linguagemCondicao: {
    operadores: ['==', '!='],
    formato: 'variavel operador "valor"',
    exemplo: 'cliente.opcao == "1"',
  },
  blocos: [
    {
      tipo: 'mensagem',
      nome: 'Mensagem',
      descricao: 'Envia um texto ao contato e segue automaticamente.',
      categoria: 'comunicacao',
      icone: 'mensagem',
      comportamento: { pausaExecucao: false, produzSaida: true, podeFinalizarFluxo: true },
      campos: [
        {
          caminho: 'dados.texto',
          rotulo: 'Mensagem',
          descricao: 'Texto enviado ao contato.',
          tipo: 'texto_longo',
          obrigatorio: true,
          valorInicial: '',
          validacao: { minimoCaracteres: 1, maximoCaracteres: 4096 },
        },
      ],
      conexoes: {
        aceitaEntrada: true,
        saidas: [
          {
            chave: 'proximo',
            rotulo: 'Próximo',
            tipo: 'unica',
            obrigatoria: false,
            quantidadeMaxima: 1,
          },
        ],
      },
      configuracaoInicial: { dados: { texto: '' } },
      exemplo: {
        id: 'boas_vindas',
        tipo: 'mensagem',
        dados: { texto: 'Olá! Como podemos ajudar?' },
        proximo: 'capturar_opcao',
      },
    },
    {
      tipo: 'captura_resposta',
      nome: 'Capturar resposta',
      descricao: 'Aguarda a próxima mensagem do contato e salva o conteúdo em uma variável.',
      categoria: 'entrada',
      icone: 'captura_resposta',
      comportamento: { pausaExecucao: true, produzSaida: true, podeFinalizarFluxo: true },
      campos: [
        {
          caminho: 'dados.variavel',
          rotulo: 'Variável',
          descricao: 'Nome usado para consultar a resposta em condições posteriores.',
          tipo: 'variavel',
          obrigatorio: true,
          valorInicial: '',
          validacao: { minimoCaracteres: 1, maximoCaracteres: 80, padrao: PADRAO_VARIAVEL },
        },
        {
          caminho: 'dados.mensagem',
          rotulo: 'Mensagem antes da captura',
          descricao: 'Pergunta opcional enviada antes de aguardar a resposta.',
          tipo: 'texto_longo',
          obrigatorio: false,
          validacao: { minimoCaracteres: 1, maximoCaracteres: 4096 },
        },
      ],
      conexoes: {
        aceitaEntrada: true,
        saidas: [
          {
            chave: 'proximo',
            rotulo: 'Após resposta',
            tipo: 'unica',
            obrigatoria: false,
            quantidadeMaxima: 1,
          },
        ],
      },
      configuracaoInicial: { dados: { variavel: '' } },
      exemplo: {
        id: 'capturar_opcao',
        tipo: 'captura_resposta',
        dados: { variavel: 'cliente.opcao', mensagem: 'Digite uma opção.' },
        proximo: 'decidir_opcao',
      },
    },
    {
      tipo: 'condicao',
      nome: 'Condição',
      descricao: 'Escolhe o próximo bloco comparando uma variável capturada com um valor.',
      categoria: 'logica',
      icone: 'condicao',
      comportamento: { pausaExecucao: false, produzSaida: false, podeFinalizarFluxo: false },
      campos: [
        {
          caminho: 'dados.regras',
          rotulo: 'Regras',
          descricao: 'Regras avaliadas em ordem; a primeira condição verdadeira define a saída.',
          tipo: 'lista_condicoes',
          obrigatorio: true,
          valorInicial: [],
          validacao: { minimoItens: 1, maximoItens: 20, maximoCaracteres: 300 },
          fonteOpcoes: { tipo: 'variaveis_fluxo' },
          serializacao: '{ "se": "{variavel} {operador} \\"{valor}\\"", "entao": "{noId}" }',
        },
        {
          caminho: 'dados.padrao',
          rotulo: 'Saída padrão',
          descricao: 'Bloco usado quando nenhuma regra for verdadeira.',
          tipo: 'referencia_no',
          obrigatorio: true,
          valorInicial: '',
          fonteOpcoes: { tipo: 'nos_fluxo' },
        },
      ],
      conexoes: {
        aceitaEntrada: true,
        saidas: [
          {
            chave: 'dados.regras[].entao',
            rotulo: 'Regra',
            tipo: 'dinamica',
            obrigatoria: true,
            quantidadeMaxima: 20,
          },
          {
            chave: 'dados.padrao',
            rotulo: 'Padrão',
            tipo: 'unica',
            obrigatoria: true,
            quantidadeMaxima: 1,
          },
        ],
      },
      configuracaoInicial: { dados: { regras: [], padrao: '' } },
      exemplo: {
        id: 'decidir_opcao',
        tipo: 'condicao',
        dados: {
          regras: [{ se: 'cliente.opcao == "1"', entao: 'atendimento' }],
          padrao: 'opcao_invalida',
        },
      },
    },
    {
      tipo: 'direcionar_setor',
      nome: 'Direcionar para setor',
      descricao: 'Encerra a automação e encaminha a conversa para a fila de um setor ativo.',
      categoria: 'atendimento',
      icone: 'direcionar_setor',
      comportamento: { pausaExecucao: true, produzSaida: true, podeFinalizarFluxo: true },
      campos: [
        {
          caminho: 'dados.setorId',
          rotulo: 'Setor',
          descricao: 'Setor ativo que receberá a conversa.',
          tipo: 'seletor_setor',
          obrigatorio: true,
          valorInicial: '',
          fonteOpcoes: {
            tipo: 'endpoint',
            metodo: 'GET',
            caminho: '/api/v1/setores',
            campoValor: 'public_id',
            campoRotulo: 'nome',
            query: { ativo: 'true', skip: '0', take: '100' },
          },
        },
      ],
      conexoes: { aceitaEntrada: true, saidas: [] },
      configuracaoInicial: { dados: { setorId: '' } },
      exemplo: {
        id: 'atendimento',
        tipo: 'direcionar_setor',
        dados: { setorId: '11111111-1111-4111-8111-111111111111' },
      },
    },
  ],
});

export class CatalogoBlocosFluxoService {
  public consultar(): CatalogoBlocosFluxo {
    return catalogo;
  }
}
