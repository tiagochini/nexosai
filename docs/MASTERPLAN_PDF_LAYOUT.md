# Exportação PDF do Master Plan — 12/10/2026

Inspeção do PDF fornecido confirmou mistura visual na página de métricas e
riscos: valores de KPI sem quebra ultrapassavam os cartões; símbolos fora
da codificação da fonte geravam espaçamento anormal e invadiam outras colunas.
Havia também avanço vertical fixo para blocos de tamanho variável.

Correções no exportador:

- Normalização consistente antes da medição, quebra e desenho de texto.
  Pontuação equivalente em ASCII; ícones não suportados removidos; português
  acentuado preservado. Não substitui a estratégia no banco.
- Cartões de KPI com quebra e altura calculada por linha, agrupados apenas
  com os indicadores preenchidos.
- Colunas de risco/mitigação com quebra independente, avanço vertical real
  e paginação. Blocos de texto e listas também respeitam margem inferior.
- Marca d'água mais suave, mantendo identificação/fingerprint. Cabeçalho
  da capa preservado, sem ser sobrescrito pelo cabeçalho das demais páginas.
- Opção de geração sem salvar automaticamente permite inspecionar o mesmo
  documento exportado pelo sistema.

Gerada cópia corrigida a partir da estratégia salva da campanha founder,
sem nova chamada à IA e sem alterar a campanha. Artefato local em
output/pdf/nexos-masterplan-corrigido.pdf. Arquivo original preservado.

As seis páginas foram renderizadas e inspecionadas. Verificação de geometria
confirmou limites horizontais do corpo e das colunas de riscos/mitigações.
Tipos e build frontend aprovados (485,4 KiB iniciais, orçamento 500 KiB).
[Resultados](./MASTERPLAN_PDF_LAYOUT_RESULTS.json).

Próximo checkpoint: usuário conferir a cópia corrigida e novos downloads.
Sem push e sem execução remota de CI nesta revisão.

## Marca d'água sob o texto — 12/10/2026

A marca diagonal agora é desenhada antes de todo texto de primeiro plano,
após os fundos da página, com opacidade de 12%. Estado gráfico isolado
preserva cor e opacidade do conteúdo, cabeçalhos e rodapés. Nome, e-mail,
fingerprint e metadados de identificação continuam presentes.

Verificada a ordem dos comandos PDF e transparência em todas as seis páginas;
renderização visual confirmou letras legíveis mesmo nas interseções. Tipos,
geometria e build frontend aprovados. Estratégia salva preservada.
Novo download usa o exportador corrigido; PDFs anteriores não mudam.
