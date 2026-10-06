# Avaliação de qualidade de IA — v1

O dataset versionado em `evals/ai-quality/v1/cases.json` cobre post social,
landing page, anúncio, estratégia e roteiro de vídeo. As referências são
fixtures sintéticas: provam o avaliador, não a qualidade de um modelo real.

Execute `pnpm run test:ai-quality` para validar referências e regressões.
Para avaliar candidatos reais, execute:

```powershell
node scripts/evaluate-ai-quality.mjs candidates.json report.json
```

O comando escreve somente métricas/hashes no relatório e retorna 2 quando a
matriz está bloqueada. Cada candidato contém `id`, `artifact`, `text`,
`generationMode: "live"`, `model` (versão exata), `promptSha256` e `generatedAt`.
`promptSha256` é o SHA-256 do arquivo de agente indicado por `promptSource` no
dataset. Uma alteração desse arquivo invalida a revisão anterior. Esse hash
cobre o template fonte; não cobre o prompt renderizado, contexto dinâmico ou
dependências compartilhadas. Registre também esses insumos no pacote privado
de homologação e reexecute a matriz quando qualquer um deles mudar.

A nota automática vale 100: estrutura/tamanho 25, fatos obrigatórios 25,
chamada para ação 20 e ausência das violações enumeradas 30. A nota mínima é
85; fatos, ação e segurança são obrigatórios. Esse screening por regras não
avalia semântica integral e não é uma garantia de segurança ou veracidade.

A revisão humana deve conter:

```json
{
  "decision": "approved",
  "reviewer": "Nome do responsável",
  "artifactSha256": "SHA-256 exato do texto UTF-8",
  "promptSha256": "SHA-256 do arquivo de agente",
  "model": "mesma versão do candidato",
  "reviewedAt": "data ISO posterior à geração",
  "ratings": { "relevance": 4, "clarity": 4, "factuality": 5, "brandVoice": 4 }
}
```

As quatro dimensões variam de 1 a 5; exige-se cada nota >=3 e média >=4.
Revisões com artefato, template ou modelo diferente bloqueiam o relatório.
Resultados ausentes também bloqueiam. Para cada versão de modelo/prompt,
produza todos os cinco artefatos, compare os relatórios anterior/novo e faça
nova revisão dos textos exatos. Mudança do dataset exige nova versão e nova
homologação; não edite v1 silenciosamente para acomodar uma regressão.

`releaseEligible` significa apenas que o pacote satisfaz esse formato e essas
regras. Metadados de geração e o nome do revisor não são autenticados pelo
script. Preserve candidatos e revisões em armazenamento restrito; obtenha
aprovação do responsável pelo processo de revisão antes de aceitar o pacote.
Este relatório não publica, não concede consentimento e não autoriza gasto.
Qualidade de modelos reais permanece pendente até essa execução externa.
