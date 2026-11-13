# Handoff: biblioteca de amostras de voz

Cole as instruções abaixo em um novo chat do Codex aberto neste repositório. O objetivo é terminar a implementação da biblioteca privada de áudios de voz e criar um commit local, sem fazer push.

---

## Instruções para o próximo chat

Implemente e conclua no código do NexOS uma biblioteca privada de amostras de voz. O usuário quer gravar e armazenar seu áudio para poder usá-lo depois como fonte de um clone de voz e, quando houver suporte no fluxo existente, como voz de mídias geradas.

### Antes de alterar

1. Leia o `AGENTS.md` aplicável e inspecione o estado atual do repositório, os arquivos alterados e o histórico recente. Não descarte nem sobrescreva mudanças do usuário.
2. Examine a implementação real antes de assumir contratos. Pontos de partida já identificados:
   - `artifacts/app/src/components/CloneStudioPanel.tsx`: gravação guiada em cinco tomadas, envio das gravações e chamada atual para `/api/workspaces/me/persona/clone-voice-multi`.
   - `artifacts/api-server/src/modules/workspaces/workspaces.routes.ts`: rotas autenticadas e persistência das configurações do workspace, incluindo a rota de clone existente.
   - `artifacts/api-server/src/lib/gcs-recordings.ts`: utilitários existentes para upload, leitura, metadados e remoção de objetos no GCS privado.
3. Preserve o fluxo atual de clone em cinco tomadas. Acrescente a opção de guardar amostras para uso posterior sem quebrar quem já faz o clone imediatamente.

### Requisitos funcionais

- Solicite consentimento explícito antes de armazenar áudio. Explique que a amostra ficará privada no workspace, poderá ser usada para preparar um clone e poderá ser removida pelo titular. Não trate o simples ato de gravar como consentimento para armazenamento ou clonagem.
- Permita gravar e salvar uma ou mais amostras de voz, com nome identificável e reprodução para conferência. A interface deve permitir listar, ouvir e excluir as amostras.
- Use o GCS privado já configurado; mantenha os objetos fora de acesso público. Use chaves geradas no servidor, escopadas ao workspace e não previsíveis. Não aceite do cliente uma chave/caminho arbitrário do GCS.
- Persista apenas metadados necessários nas configurações do workspace ou no mecanismo persistente que o projeto já usa. Um registro pode conter `sampleId`, nome, duração, tipo MIME, tamanho, data de criação e data/versão do consentimento. Não armazene áudio/base64 no JSON do workspace.
- Crie endpoints autenticados para listar metadados, enviar/gravar, reproduzir/baixar com autorização e excluir amostras. Em toda operação, derive o workspace do usuário autenticado e verifique a propriedade no servidor. Nunca permita acessar amostras de outro usuário/workspace por troca de ID.
- Faça validação estrita de formato, MIME, tamanho, duração e quantidade de amostras; siga limites já adotados pelo produto quando existirem. Rejeite conteúdo inválido com mensagens úteis.
- Trate falhas entre o upload e a gravação dos metadados: evite deixar objetos órfãos quando possível e mantenha o estado consistente se uma das operações falhar. Não registre conteúdo de áudio, tokens, URLs assinadas ou chaves privadas nos logs.
- Permita selecionar uma amostra salva para iniciar o clone. O servidor deve ler o áudio do GCS autorizado e conectá-lo ao provedor de clonagem já integrado (a tela mostra erro quando `ELEVENLABS_API_KEY` não está configurada). Persista o identificador do clone no formato que os fluxos atuais de geração de voz/mídia já consomem; inspecione esses consumidores antes de definir o formato.
- Se a integração de mídias já permitir selecionar uma voz clonada, faça a amostra/clonagem ficar disponível nesse fluxo. Se não permitir, implemente a persistência e a compatibilidade necessárias sem afirmar na interface que toda mídia já usa a voz automaticamente.
- Exiba estados de carregamento, sucesso e erro em português. Uma indisponibilidade do provedor não deve apagar nem invalidar a amostra salva.
- Faça revisão de segurança para autenticação, autorização por workspace, privacidade, limites de upload, remoção dos objetos e tratamento de falhas.

### Validação e escopo

- Não altere funcionalidades não relacionadas.
- Não adicione nem execute testes automatizados, salvo se o usuário pedir explicitamente testes/verificação. Faça revisão estática do diff e use `git diff --check` se apropriado.
- Não inclua credenciais, dados pessoais, arquivos temporários ou áudio real nos commits.

### Commit obrigatório, sem push

Ao terminar:

1. Revise `git status --short` e o diff completo.
2. Stage somente os arquivos pertencentes a esta implementação.
3. Existe uma alteração preexistente e não relacionada em `artifacts/app/src/pages/market-intel/index.tsx`. Preserve-a e não a inclua no commit.
4. Crie um commit local com uma mensagem clara, por exemplo `feat(voice): add private voice sample library`.
5. Não faça push, não publique/deploy e não altere o banco remoto.
6. Na resposta final, informe o que foi implementado, as verificações feitas, o SHA do commit e confirme que nenhum push foi realizado. Se algo impedir a conclusão, explique o bloqueio sem criar um commit parcial enganoso.

---
