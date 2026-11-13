# Descoberta da KAIROGEN

Requer Node.js 22 ou superior. Não instala dependências e não altera a integração de produção.

```powershell
node scripts/kairogen-discover.mjs --public-only
```

O script consulta os metadados OAuth públicos, inicializa o MCP e tenta listar ferramentas com seus schemas de entrada/saída. Também lista recursos e prompts se anunciados pelo servidor. Não procura rotas privadas por tentativa e erro: ferramentas MCP não são uma lista de rotas REST.

Para consultar com a sua conta sem copiar tokens, execute:

```powershell
node scripts/kairogen-discover.mjs --login
```

Abra a URL exibida no navegador e informe o código de autorização. O script usa o fluxo de dispositivo anunciado nos metadados e solicita apenas `kairogen:read`. Se não houver `KAIROGEN_CLIENT_ID`, tenta registrar um cliente OAuth público no endpoint anunciado pelo provedor. Se o provedor recusar esse registro, será necessário solicitar um client ID. O token fica somente na memória, é usado na descoberta e não é gravado. O login aguarda no máximo dez minutos.

Alternativamente, adicione um **access token OAuth válido da KAIROGEN** ao `.env.local` privado e ignorado pelo Git:

```dotenv
KAIROGEN_ACCESS_TOKEN=
```

Não use senha, cookie de navegador ou token de outro provedor. Ter uma conta não basta: a emissão do token depende do fluxo OAuth efetivamente oferecido pela KAIROGEN. O script não implementa renovação de tokens.

```powershell
node scripts/kairogen-discover.mjs
# Ou selecione explicitamente outro arquivo privado:
node scripts/kairogen-discover.mjs --env-file .env.homologation.local
```

Variáveis do processo têm prioridade sobre o arquivo. Por padrão, o relatório é gravado em `tmp/kairogen-discovery.json`; `--out caminho` altera o destino. O relatório preserva as descrições e schemas retornados pelo provedor, remove tokens conhecidos e não inclui o ID da sessão. Não publique esse relatório sem revisar informações da conta e URLs que o servidor eventualmente retornar.

Sem `--inspect`, nenhuma chamada `tools/call` é permitida. Falhas de rede, autenticação ou listagem produzem código de saída 1 e constam no relatório. Falhas apenas nos metadados públicos são registradas e não impedem a tentativa MCP.

## Consulta dos modelos e da conta

```powershell
node scripts/kairogen-discover.mjs --login --inspect
```

Após a autenticação, executa exclusivamente `list_models`, `get_me_context`, `get_credits` e `get_voices_data` (primeira página, até 100 vozes, incluindo clones). As ferramentas precisam estar anunciadas como somente leitura. Esta opção não gera mídia, não estima preços, não altera planos e não compra créditos. A lista de vozes pode vir paginada; confira `nextPageToken` no resultado antes de considerar o catálogo completo.

Os resultados completos, incluindo eventuais erros de autorização por ferramenta, ficam em `tmp/kairogen-inspection.json`. O relatório pode conter dados privados da conta e das vozes: mantenha-o local. O escopo solicitado continua sendo apenas `kairogen:read`; se alguma consulta exigir outro escopo, o script registra a falha sem ampliar permissões automaticamente. O relatório de descoberta anterior é preservado.

## Conhecimento confirmado para a integração Nexos

A descoberta autenticada anterior anunciou 81 ferramentas, 11 recursos e 40 prompts. Isso confirma os contratos anunciados pelo servidor, sem comprovar execução ou disponibilidade de cada recurso no plano.

Na inspeção autenticada de 13/11/2026, as quatro consultas (`list_models`, `get_me_context`, `get_credits`, `get_voices_data`) retornaram sem erro. O catálogo retornou 43 modelos (21 de imagem e 22 de vídeo), incluindo parâmetros por modo e referências. A consulta de vozes retornou 100 entradas, das quais 33 com idioma/locale português, todas essas `pt-BR`; nenhum `nextPageToken` foi informado, mas a consulta tinha limite de 100, portanto não comprova que esse seja todo o catálogo. Nomes e provedores são declarações da KAIROGEN, sem validação independente dos modelos subjacentes.

O plano consultado aplica limite global de uma geração simultânea, além de limites individuais de uma imagem e um vídeo. Esses limites individuais não significam que imagem e vídeo possam rodar ao mesmo tempo: deve-se respeitar também o teto global. Nenhuma geração, compra ou alteração de plano foi executada. Saldo e demais dados privados estão apenas no relatório local ignorado pelo Git.

Os resultados de ferramentas vieram como JSON serializado em `content` de tipo `text`, não apenas em `structuredContent`. O adaptador de produção precisará tratar os dois formatos e `isError`, inclusive respostas HTTP/JSON-RPC bem-sucedidas com erro dentro do resultado da ferramenta.

- `list_models` não exige argumentos. O retorno deve fornecer as chaves reais dos modelos e seus parâmetros específicos; não fixar nomes de modelos com base apenas em material comercial.
- `estimate_cost` exige `model` e `plan_key`. A cotação precisa usar os mesmos parâmetros e referências da geração. O plano deve vir da conta, não ser presumido.
- `generate_image` e `generate_video` exigem `model` e `prompt`, aceitam `expected_credits` para conferência de custo e `wait_for_completion: false` para retorno assíncrono. A implementação deve registrar o `generation_id` e consultar `get_generation`.
- Áudio tem contratos próprios: `generate_audio` para fala, música e efeitos; narração e dublagem de vídeo usam jobs específicos e `get_audio_job_status`. Não presumir um único endpoint de status para todos os tipos.
- Há ferramentas de cobrança e alteração de plano. O adaptador de mídia do Nexos deve expor apenas operações necessárias, com lista explícita de ferramentas permitidas.
- A integração persistente ainda precisa de armazenamento seguro e renovação OAuth, associação de cada job ao cliente/workspace do Nexos, controle de custos e concorrência, e tratamento de falhas. As gerações não devem ser repetidas automaticamente após timeout sem confirmar o resultado anterior, para evitar cobranças duplicadas.
- A permissão comercial para atender múltiplos clientes, os limites efetivos e um teste real de geração continuam pendentes. O catálogo MCP não resolve essas condições.

## Provedor primário de imagens e vídeos no Nexos

Implementado no código do backend:

- Criativos: KAIROGEN → OpenAI → Gemini → proxy OpenAI já existente.
- Frames de presença social: KAIROGEN → modelos Gemini → modelos OpenAI já existentes.
- Clipes de vídeo: KAIROGEN → Runway, ou Kling quando Runway não estiver configurado, preservando a seleção anterior. Avatares HeyGen e execução nativa continuam nos seus fluxos específicos.

Antes de submeter, a KAIROGEN consulta o plano e a concorrência ativa, o saldo, o catálogo e a cotação. Só envia se houver saldo para o **custo cotado**, usando os mesmos parâmetros e `expected_credits`. Saldo zero/insuficiente, capacidade ocupada ou indisponibilidade antes da submissão permitem seguir para o próximo provedor. O catálogo não fica fixado no código; as chaves dos modelos iniciais são configuráveis (`nano-banana-2` e `wan-2-6`). Parâmetros incompatíveis com o modelo escolhido fazem a KAIROGEN ser pulada antes de gastar créditos.

Pedidos aceitos são acompanhados por ID. Vídeos usam o polling existente do Nexos; imagens aguardam até quatro minutos e convertem o arquivo verificado em data URL. Não há fallback automático após um timeout de submissão, um pedido pendente/aceito ou um bloqueio de segurança. Isso evita enviar imediatamente uma segunda geração paga. Uma imagem pendente após o limite exige acompanhamento/reconciliação; não há ainda endpoint de retomada automática de imagem. Não repetir manualmente um pedido com resultado desconhecido sem conferir a conta KAIROGEN.

O Redis coordena o trecho de pré-checagem/submissão entre processos. O limite real da conta ainda é verificado na KAIROGEN. Se Redis estiver indisponível antes do envio, a seleção segue aos provedores seguintes. Referências de jobs aceitos são guardadas por sete dias para recuperação operacional, sem prompts ou dados dos clientes.

### Autorizar a credencial da plataforma

O login de inspeção anterior era temporário e somente leitura. Para ativar geração:

```powershell
node scripts/kairogen-connect.mjs
# Ou configure explicitamente o ambiente de homologação:
node scripts/kairogen-connect.mjs --env-file .env.homologation.local
```

Autorize o código no navegador. O script solicita `kairogen:read kairogen:generate` e salva client ID, access token, refresh token (se retornado) e expiração apenas no arquivo de ambiente privado ignorado pelo Git. Não pede escopo de cobrança e não gera mídia. Reinicie a API após a autorização. Se não houver refresh token, será necessário novo login quando o acesso expirar.

Para renovação automática, mantenha `INTEGRATION_TOKEN_ENCRYPTION_KEY` válida e Redis persistente. Tokens rotacionados são armazenados criptografados no Redis e lidos após reinícios; o token de renovação anterior do `.env` pode deixar de funcionar se esse estado for perdido. Preserve backups e persistência do Redis ou refaça o login em caso de perda. Credenciais locais não são automaticamente enviadas ao servidor de produção.

Variáveis documentadas em `.env.example`: `KAIROGEN_ENABLED`, `KAIROGEN_ACCESS_TOKEN`, `KAIROGEN_REFRESH_TOKEN`, `KAIROGEN_CLIENT_ID`, `KAIROGEN_TOKEN_EXPIRES_AT` (epoch em milissegundos), `KAIROGEN_IMAGE_MODEL`, `KAIROGEN_VIDEO_MODEL` e `KAIROGEN_MEDIA_HOSTS`. Sem credenciais ou com `KAIROGEN_ENABLED=false`, permanece a seleção anterior. Downloads aceitam somente HTTPS e hosts explicitamente permitidos, não seguem redirecionamentos e não enviam o Bearer para o CDN.

### Validação

```powershell
node --test scripts/kairogen-discover.test.mjs
node artifacts/api-server/node_modules/tsx/dist/cli.mjs artifacts/api-server/src/scripts/test-kairogen-provider.ts
node artifacts/api-server/node_modules/tsx/dist/cli.mjs artifacts/api-server/src/scripts/test-kairogen-routing.ts
node artifacts/api-server/node_modules/tsx/dist/cli.mjs artifacts/api-server/src/scripts/test-creative-image-fallback.ts
```

Testes com HTTP/Redis simulados cobrem prioridade de imagem/vídeo, saldo positivo abaixo da cotação, concorrência, cotação idêntica ao envio, polling, renovação/rotação criptografada OAuth, bloqueios de segurança e ausência de nova tentativa após resultado incerto. Nenhum teste solicita mídia paga. Teste real de geração e ativação no servidor continuam separados da validação local.

```powershell
node --test scripts/kairogen-discover.test.mjs
```

Referências: https://kairogen.ai/mcp-imagem-e-video e https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
