/**
 * Template de etapas (steps) do checklist LLC.
 * Fonte única para criação de processos LLC e exibição dos cards por etapa.
 * expectedDays = SLA da etapa em dias.
 */
export const LLC_STEPS_TEMPLATE = [
  { order: 1, title: "Planilha Base LLC", assignee: "Vendedor", department: "Comercial", expectedDays: 1 },
  { order: 2, title: "Arquivamento Digital: iCloud", assignee: "Vendedor", department: "Comercial", expectedDays: 1 },
  { order: 3, title: "AO: Articles of Organization", assignee: "Gustavo", department: "Administrativo", expectedDays: 3 },
  { order: 4, title: "SS4 e 8821: Preencher", assignee: "Oswaldo", department: "Administrativo", expectedDays: 2 },
  { order: 5, title: "SS4 e 8821: Assinados", assignee: "Pós-Venda", department: "Suporte", expectedDays: 2 },
  { order: 6, title: "SS4 e 8821: Enviado IRS", assignee: "Oswaldo", department: "Administrativo", expectedDays: 1 },
  { order: 7, title: "Ligação IRS: EIN Number + Letter Fax", assignee: "Oswaldo", department: "Administrativo", expectedDays: 5 },
  { order: 8, title: "BOIR", assignee: "João", department: "TI", expectedDays: 2 },
  { order: 9, title: "BE-13", assignee: "João", department: "TI", expectedDays: 2 },
  { order: 10, title: "Aplicação Banco Digital", assignee: "Luís", department: "TI", expectedDays: 3 },
  { order: 11, title: "Abertura Banco Tradicional", assignee: "Gustavo", department: "Administrativo", expectedDays: 5 },
] as const;

export type LlcStepRow = (typeof LLC_STEPS_TEMPLATE)[number];
