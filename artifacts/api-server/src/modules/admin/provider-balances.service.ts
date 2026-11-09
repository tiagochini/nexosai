export interface ProviderBalance {
  provider: string;
  name: string;
  status: 'available' | 'manual' | 'console_only' | 'not_configured' | 'error';
  balanceUsd: number | null;
  checkedAt: string | null;
  message: string;
  billingUrl: string;
}

// xAI represents prepaid credits as a negative accounting balance in USD cents.
// Source: https://docs.x.ai/developers/rest-api-reference/management/billing
export function parseXaiBalance(payload: unknown): number {
  const total = (payload as { total?: { val?: unknown } } | null)?.total?.val;
  if (typeof total !== 'string' || !/^-?\d+$/.test(total) || !Number.isSafeInteger(Number(total))) {
    throw new Error('INVALID_BALANCE_RESPONSE');
  }
  return -Number(total) / 100;
}

export async function getProviderBalances(
  config: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
  snapshots: Record<string, { balanceUsd: number; checkedAt: string; updatedBy: string }> = {},
): Promise<{ providers: ProviderBalance[] }> {
  const providers: ProviderBalance[] = [
    { provider: 'openai', name: 'OpenAI', status: 'console_only', balanceUsd: null, checkedAt: null,
      message: 'Consulta automática de saldo restante indisponível neste conector. Consulte o faturamento da organização.',
      billingUrl: 'https://platform.openai.com/settings/organization/billing/overview' },
    { provider: 'anthropic', name: 'Anthropic / Claude', status: 'console_only', balanceUsd: null, checkedAt: null,
      message: 'Os relatórios de uso e custo não informam o crédito restante. Consulte o faturamento da organização.',
      billingUrl: 'https://platform.claude.com/settings/billing' },
    { provider: 'gemini', name: 'Google / Gemini', status: 'console_only', balanceUsd: null, checkedAt: null,
      message: 'Consulte créditos pré-pagos ou cobranças do seu plano na conta de faturamento do AI Studio.',
      billingUrl: 'https://aistudio.google.com/' },
  ];
  const grok: ProviderBalance = { provider: 'xai', name: 'xAI / Grok', status: 'not_configured', balanceUsd: null, checkedAt: null,
    message: 'Consulta pendente de configuração da chave de gerenciamento e da equipe xAI no servidor.', billingUrl: 'https://console.x.ai/' };
  providers.push(grok);
  for (const provider of providers) {
    const snapshot = snapshots[provider.provider];
    if (!snapshot || !Number.isFinite(snapshot.balanceUsd) || snapshot.balanceUsd < 0 || !snapshot.checkedAt) continue;
    provider.balanceUsd = snapshot.balanceUsd;
    provider.checkedAt = snapshot.checkedAt;
    provider.status = 'manual';
    provider.message = `Saldo informado manualmente em ${new Date(snapshot.checkedAt).toLocaleString('pt-BR')}. Confira no painel do provedor.`;
  }
  const key = config['XAI_MANAGEMENT_API_KEY']?.trim();
  const teamId = config['XAI_TEAM_ID']?.trim();
  if (!key || !teamId) return { providers };
  try {
    const response = await request('https://management-api.x.ai/v1/billing/teams/' + encodeURIComponent(teamId) + '/prepaid/balance', {
      method: 'GET', headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000), redirect: 'error',
    });
    if (!response.ok) {
      grok.status = 'error';
      grok.message = response.status === 401 || response.status === 403
        ? 'Acesso ao faturamento recusado. Verifique a chave de gerenciamento e as permissões da equipe.'
        : 'O provedor não disponibilizou o saldo agora. Tente atualizar novamente.';
      return { providers };
    }
    grok.balanceUsd = parseXaiBalance(await response.json());
    grok.status = 'available';
    grok.checkedAt = new Date().toISOString();
    grok.message = 'Crédito pré-pago informado pela xAI. Cobranças pós-pagas e limites mensais são separados.';
  } catch {
    // Never expose provider bodies, exceptions, team IDs or management credentials.
    grok.status = 'error';
    grok.message = 'Não foi possível confirmar o saldo no provedor. Tente atualizar novamente.';
  }
  return { providers };
}
