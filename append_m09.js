const fs = require('fs');
let content = fs.readFileSync('NEXOS_BUILD_CHECKLIST.md', 'utf8');

const m09Section = `
## Última unidade concluída — M09 Contratos de realização

### Entregue no código

- [x] Contrato de realização unificado atuando como ledger para execuções externas;
- [x] Suporte restrito a \`paid_media_pause\` e \`paid_media_launch\`, explicitly labeling any other verticals as unsupported/not governed;
- [x] State machine determinística para cada contrato (proposal, preflight, provider_confirmed, artifact_qc, recovery, etc.);
- [x] Tracking de idempotency key, context fingerprint, bind hash e masterplan association;
- [x] Orquestração transacional de retry, compensação durável e readback;
- [x] UI nativa responsiva M09 conectada ao Control Room (sumários e logs visuais dos attempts);
- [x] Actions rigorosas no Frontend: Retry, QC, Monitor, Compensate (execute só se valid).
- [x] Componentes \`RealizationContractPanel\` e Drawer implementados com a estética correta.

### Validação concluída

- [x] Migrations Drizzle aplicadas, OpenAPI definitions integradas e sem quebras (\`codegen\` OK);
- [x] Hooks gerados pelo Orval consumidos adequadamente pelo Frontend App;
- [x] Typechecks concluídos sem erro (0 errors in UI);
- [x] \`npm run build\` aprovado para produção (\`BASE_PATH=/\` \`PORT=3000\`).
- [x] Nenhuma criação inventada sem approval subject autorizado; estado de "zero contratos" lida apropriadamente com empty-states no UI.
`;

// Append to file
fs.appendFileSync('NEXOS_BUILD_CHECKLIST.md', m09Section);
