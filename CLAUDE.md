# CLAUDE.md — NexOS AI
## Doutrina Operacional Permanente
### Este arquivo governa TODA sessão de trabalho neste projeto. Leia integralmente antes de qualquer ação.

---

## 1. QUEM MANDA E COMO

- O Founder (Bruce) aprova. Você propõe, executa sob aprovação, e reporta.
- **NUNCA altere, "melhore" ou reescreva conteúdo existente (copy, textos, documentos, estrutura de produto) sem ordem explícita.** Correção de bug ≠ licença pra refatorar o que funciona.
- Em dúvida entre duas interpretações: PARE e pergunte. Nunca assuma em silêncio.
- Reporte em linguagem direta. Sem otimismo decorativo. Um status é: FUNCIONA (verificado) ou NÃO FUNCIONA (com causa raiz).

## 2. DOUTRINA CENTRAL — EFICIÊNCIA ≠ EFICÁCIA

- **Eficiência** = o sistema rodou sem crashar. IRRELEVANTE como critério de sucesso.
- **Eficácia** = o efeito real externo aconteceu: o arquivo existe e abre, o post está NA plataforma, a mensagem CHEGOU, a cobrança foi gerada E o webhook voltou, o token está VIVO no fim do fluxo.
- **GRACEFUL DEGRADATION = FAIL.** Se o sistema contornou um erro e não entregou o efeito real, é FALHA — mesmo que a UI mostre "concluído". Contorno silencioso é o pior bug deste projeto.
- **"Sucesso silencioso" é PROIBIDO:** nenhuma etapa pode reportar sucesso baseada apenas em log interno. Toda confirmação vem da FONTE EXTERNA (API da plataforma de destino, URL pública, arquivo baixado e verificado, webhook recebido).

## 3. REGRA DE VERIFICAÇÃO EXTERNA (inegociável)

Antes de marcar QUALQUER tarefa como resolvida:
1. Execute a verificação na fonte externa correspondente
2. Registre a evidência (response da API externa, URL testada com status, hash/tamanho do arquivo)
3. Só então reporte como resolvido — citando a evidência

Sem evidência externa = tarefa ABERTA. Sem exceção.

## 3.5. HIERARQUIA LÓGICA (vale pra VOCÊ e pra todo agente do produto)

Ordem de prioridade em todo raciocínio: **1) OBJETIVO da tarefa → 2) RESTRIÇÕES REAIS → 3) PREFERÊNCIAS DECLARADAS.**
Quando a preferência conflita com o objetivo: nomeie o conflito, proponha o caminho que satisfaz ambos, nunca resolva em silêncio, nunca obedeça cegamente. "Agradar e falhar" é a versão de raciocínio do sucesso silencioso — PROIBIDO. (Teste de referência: o carro na revisão a 400m — dirigir até lá e VOLTAR a pé.)

## 4. DOCUMENTOS IRMÃOS (leia junto com este)

- `TESTE_EFICACIA_NEXOS.md` — contrato de entrega dos fluxos (agora 12, incluindo auditoria de raciocínio e veredito de viabilidade)
- `NEXOS_JORNADA_COMPLETA.md` — especificação da jornada completa (Fluxo 0, OAuth, Masterplan, régua, Sala de Lançamento + adendos v1.1: Viabilidade, Biblioteca dos agentes, Hierarquia lógica)
- `ARSENAL_DO_FUNDADOR.md` — técnicas proprietárias do fundador (Grande SE, Convicção Lastreada, protocolo Red Pen) — fonte de introjeção dos agentes de copy/vendas. O protocolo Red Pen (captura de reescritas do fundador → guia de estilo vivo → gate "nível do fundador") deve ser implementado como feature do produto.

Conflito entre código atual e esses documentos → os documentos são a intenção; sinalize o conflito ao Founder antes de resolver.

## 5. PROTOCOLO DAS 4 FASES (ordem obrigatória de trabalho)

**FASE 1 — Fundação (Fluxo 8): Tokens e Estado**
- Mapear como CADA token/credencial de integração é armazenado, renovado e recuperado hoje
- Encontrar todos os pontos onde estado se perde (memória volátil, secrets ausentes em prod, expiração sem refresh)
- Implementar/consolidar o Token Lifecycle Manager: persistência criptografada em DB, ciclo de vida por plataforma (Meta 60d, TikTok refresh 24h, Telegram bot token fixo, Asaas chave fixa, Resend chave fixa), renovação automática ANTES da expiração, re-validação de todas as conexões no início de todo lançamento
- **Nada da Fase 2 começa antes da Fase 1 passar** — falha aqui contamina todos os outros testes

**FASE 2 — Auditoria de entrega, fluxo por fluxo**
- Rodar cada fluxo do TESTE_EFICACIA em ambiente real (produção ou réplica exata com os mesmos secrets e integrações reais)
- Para cada FAIL: documentar etapa · entregável ausente · causa raiz · correção · re-teste com evidência externa
- Ordem: Fluxo 1 (cadeia completa) primeiro após a fundação, depois os demais

**FASE 3 — Critério de Ápice em 4 CAMADAS (definição objetiva de "pronto")**

*Camada 1 — Estabilidade do sistema:*
> O lançamento completo, do intake ao botão de lançamento, executado **3 VEZES CONSECUTIVAS** com: 100% dos entregáveis verificados na fonte externa · ZERO intervenção manual · ZERO erro visível ao usuário Founder. Uma execução limpa pode ser sorte. Três consecutivas é sistema. Qualquer falha zera a contagem.
> Necessária, mas INSUFICIENTE — prova o sistema, não o usuário.

*Camada 2 — Variação de persona (a Escada dos 5 Lançamentos):*
As execuções NÃO devem ser idênticas. Roteiro oficial, em escada de dificuldade — cada degrau testa músculos novos:
1. **Curso digital de lançamento** (≈ NexOS Academy) — caso nativo do PLF: checkout direto, ciclo curto. Se falha aqui, falha em tudo.
2. **Carros e motos** — tipologia lead local: funil termina em lead qualificado + agendamento, não em checkout. Testa targeting geográfico, WhatsApp como canal de conversão, entrega de lead a vendedor humano.
3. **Projeto imobiliário na planta** — ticket altíssimo, ciclo longo: nutrição por semanas, remarketing longo, compliance imobiliário (CRECI, memorial, "imagens ilustrativas").
4. **Robô trader (ClauD'Midas)** — categoria regulada: campanha PODEROSA sem uma única promessa de rentabilidade (CVM/ASIC) e dentro das políticas de trading de Meta/Google. Teste de fogo do Compliance Officer e do Veredito de Viabilidade.
5. **Criptomoeda (ARB)** — chefe final, em **MODO DRY-RUN obrigatório**: campanhas criadas e PAUSADAS, funil completo, compliance auditado — mídia real SOMENTE após enquadramento jurídico do token. Prova que o sistema sabe, sem exposição.
+ personas de estresse: briefing confuso/contraditório · cliente que insiste contra o veredito · Ramo B (só ideia) · Ramo C (afiliado).

*Camada 3 — Teste de caos (recuperação):*
Quebrar deliberadamente no meio do fluxo e verificar retomada sem perda: conexão derrubada durante OAuth · token expirado no meio do lançamento · navegador fechado no meio do intake · boleto pago com retorno só no dia seguinte · troca Founder↔Architect em qualquer tela. O sistema sobrevive e retoma de onde parou.

*Camada 4 — Humanos reais (nenhuma simulação substitui):*
Beta fechado com **5–10 pessoas leigas de verdade**, produto real, dinheiro real (mesmo que pouco), Founder observando SEM ajudar.
> **ÁPICE = Camadas 1–3 passadas (sistema pronto pra beta) + 5+ usuários reais completando lançamento sem intervenção.**
> Só então: autorização para a Fase 4.
> Ao final, os 5 lançamentos da escada = 5 cases documentados em 5 verticais para o Self-Proof.

**FASE 4 — Teste Supremo: Self-Launch**
- O primeiro lançamento real do próprio NexOS executado DENTRO do NexOS
- Se a máquina não consegue se lançar, não está pronta pra lançar ninguém
- Sucesso aqui = prova técnica + primeiro case do Self-Proof + ignição do motor composto

## 6. REGRAS DE ENGENHARIA

- Estado NUNCA em variável de memória entre etapas de fluxo: tudo que precisa sobreviver vai pra DB/secrets
- Toda integração externa: retry com backoff exponencial → em falha persistente, alerta ao usuário com ação clara em linguagem Founder — nunca stack trace cru no modo Founder, nunca prosseguir fingindo sucesso
- Falha que consome créditos do cliente sem entrega = estorno automático obrigatório
- Todo fluxo novo nasce com seu teste end-to-end de eficácia correspondente (verificação externa incluída)
- Dev ≠ Prod: antes de qualquer diagnóstico, comparar secrets/variáveis de ambiente entre os dois — ausência em prod é suspeito número 1 de qualquer "funciona em dev"
- Dupla camada Founder/Architect em toda superfície nova: linguagem sem jargão + recomendação única (Founder) / parâmetros e dados crus (Architect); o switch preserva 100% do estado

## 7. RITUAL DE SESSÃO

**Ao iniciar cada sessão:**
1. Ler este arquivo + os dois documentos irmãos
2. Ler `PROGRESS.md` (ver abaixo) para saber onde a última sessão parou
3. Anunciar: fase atual, próxima tarefa, e o que precisa de aprovação

**Ao encerrar cada sessão (ou grande bloco de trabalho):**
- Atualizar `PROGRESS.md` com: data · fase · o que foi verificado (com evidência) · o que está aberto · próximo passo
- Este arquivo é a memória entre sessões. Sessão sem registro = trabalho perdido.

**Contagem do Ápice:** manter em `PROGRESS.md` o placar explícito das 4 camadas — "C1 execuções limpas: N/3 · C2 escada: degrau X/5 + personas de estresse · C3 caos: cenários passados/total · C4 beta: usuários completos N/5" — e o motivo de qualquer zeragem.

## 8. STACK & AMBIENTE (referência rápida)

- Plataforma: Replit (dev + deploy)
- Real-time: Socket.io (Live Production Display)
- Pagamentos: Asaas (cobranças, webhooks de venda, validação de afiliados por CPF)
- E-mail: Resend
- Integrações sociais: Meta Graph API (IG/FB/WhatsApp Business via Embedded Signup), TikTok for Business, Kwai, Telegram Bot API
- Anti-pirataria: Masterprint — todo asset exportado recebe fingerprint NXS-XXXX-XXXX + cadeia de custódia (userId, email, IP, user-agent, workspace, campanha, timestamp)

## 9. O QUE ESTÁ EM JOGO (contexto pro julgamento)

O NexOS é um motor de lançamentos que se auto-lança: cada ciclo financia e prova o seguinte. O composto multiplica o que estiver na base — entrega perfeita OU falha. Por isso este projeto não aceita "quase funciona": o ciclo 1 é o combustível de todos os outros. Seu trabalho aqui não é fazer o código rodar. É garantir que a máquina ENTREGA — verificado, três vezes seguidas, na fonte externa.
