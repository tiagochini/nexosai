/** Informational readiness only: scores measure supplied evidence, never sales probability. */
export interface BriefingDimension {
  area: string;
  specialist: string;
  score: number;
  strengths: string[];
  gaps: Array<{ field: string; observation: string; action: string }>;
}
export interface BriefingAssessment {
  version: 1;
  score: number;
  dimensions: BriefingDimension[];
}

type Check = [field: string, observation: string, action: string, detailed?: boolean];
const AREAS: Array<{ area: string; specialist: string; checks: Check[] }> = [
  { area: 'Produto', specialist: 'Érico', checks: [
    ['product.name', 'Produto ainda não identificado.', 'Definir o produto prioritário.'],
    ['product.description', 'Transformação e mecanismo precisam de detalhes.', 'Descrever o resultado esperado e como a entrega ajuda a alcançá-lo.', true],
    ['product.deliveryMethod', 'Forma de entrega pendente.', 'Definir formato, suporte e capacidade de atendimento.'],
  ] },
  { area: 'Público', specialist: 'Ryan', checks: [
    ['audience.description', 'Segmento prioritário pouco definido.', 'Escolher um segmento e descrever sua situação atual.', true],
    ['audience.painPoints', 'Problema de compra ainda pouco específico.', 'Trazer um exemplo real do problema enfrentado pelo cliente.', true],
    ['audience.desires', 'Resultado desejado precisa de contexto.', 'Descrever o que muda no dia a dia após resolver o problema.', true],
  ] },
  { area: 'Oferta e posicionamento', specialist: 'Érico', checks: [
    ['product.price', 'Preço ainda não definido.', 'Definir um preço ou uma hipótese de preço para validar.'],
    ['creator.uniqueAngle', 'Diferenciação precisa de evidências.', 'Explicar por que o cliente escolheria esta solução entre as alternativas.', true],
    ['product.socialProof', 'Evidência de resultado ainda insuficiente.', 'Reunir prova verificável; se não houver, planejar um piloto sem inventar depoimentos.', true],
  ] },
  { area: 'Viabilidade', specialist: 'Jeff', checks: [
    ['campaign.revenueTarget', 'Meta financeira pendente.', 'Definir a meta e calcular as vendas necessárias a partir do preço.'],
    ['campaign.budget.total', 'Orçamento total pendente.', 'Informar o teto disponível, incluindo uma operação sem investimento se for o caso.'],
    ['campaign.budget.traffic', 'Investimento de mídia pendente.', 'Definir a verba de mídia; zero é uma resposta válida para uma estratégia orgânica.'],
  ] },
  { area: 'Canais', specialist: 'Chet', checks: [
    ['campaign.salesChannel', 'Caminho até a compra pendente.', 'Escolher onde a conversão será concluída.'],
    ['audience.location', 'Abrangência do público pendente.', 'Definir onde o público pode ser atendido.'],
    ['creator.positioning', 'Posicionamento da comunicação pendente.', 'Definir o papel da marca ou especialista na comunicação.'],
  ] },
  { area: 'Execução', specialist: 'Walker', checks: [
    ['campaign.timeline', 'Horizonte de execução pendente.', 'Definir o período de teste ou calendário da campanha.'],
    ['risk.tolerance', 'Limites de risco pendentes.', 'Estabelecer os limites de teste e quando revisar a estratégia.'],
    ['risk.previousCampaigns', 'Histórico ainda não registrado.', 'Registrar resultados anteriores ou declarar que esta será a primeira campanha.'],
  ] },
];

function evidence(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.some(evidence);
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && !/^(não sei|nao sei|não tenho|nao tenho|nenhum|nenhuma|a definir|não definido|nao definido|talvez|n[/]a|não se aplica|nao se aplica)[.!]?$/i.test(text);
}

export function assessBriefing(data: Record<string, unknown>): BriefingAssessment {
  const dimensions = AREAS.map(({ area, specialist, checks }): BriefingDimension => {
    let points = 0;
    const strengths: string[] = [];
    const gaps: BriefingDimension['gaps'] = [];
    for (const [field, observation, action, detailed] of checks) {
      const value = field === 'campaign.timeline'
        ? data[field] ?? data['campaign.durationDays'] ?? data['launch.cartOpenDate']
        : data[field];
      const numeric = ['product.price', 'campaign.revenueTarget', 'campaign.budget.total', 'campaign.budget.traffic'].includes(field);
      const validNumber = (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0;
      const absentProof = field === 'product.socialProof' && typeof value === 'string' && /^(não tenho|nao tenho|ainda não|ainda nao|sem prova|sem depoimento)/i.test(value.trim());
      const supplied = evidence(value) && (!numeric || validNumber) && !absentProof;
      const specific = supplied && (!detailed || (typeof value === 'string' && value.trim().split(/\s+/).length >= 8));
      points += specific ? 1 : supplied ? 0.5 : 0;
      if (specific) strengths.push(field);
      else gaps.push({ field, observation, action });
    }
    return { area, specialist, score: Math.round(points / checks.length * 100), strengths, gaps };
  });
  return { version: 1, score: Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length), dimensions };
}

export function formatBriefingAssessment(assessment: BriefingAssessment, final = false): string {
  const scores = assessment.dimensions.map(d => d.area + ': ' + d.score + '/100').join(' · ');
  const ordered = [...assessment.dimensions].sort((a,b) => a.score - b.score);
  const actions = ordered.filter(d => d.gaps.length).slice(0, final ? 6 : 2)
    .map((d, i) => (i + 1) + '. **' + d.specialist + ' — ' + d.area + ':** ' + d.gaps[0]!.observation + ' Próximo passo: ' + d.gaps[0]!.action);
  return '**Diagnóstico do briefing — ' + assessment.score + '/100**\n' +
    'A nota mede preenchimento e detalhamento das informações; não prevê vendas nem comprova os resultados declarados.\n\n' + scores +
    (actions.length ? '\n\n**' + (final ? 'Plano de melhoria por prioridade' : 'Próximos passos prioritários') + '**\n' + actions.join('\n') : '\n\nAs informações avaliadas foram detalhadas. Valide as hipóteses com dados da campanha.');
}
