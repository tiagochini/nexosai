type ImageErrorMessage = readonly [string, string, string];

/** Never expose raw provider errors (which may include account identifiers). */
export function imageGenerationErrorMessage(error: unknown): ImageErrorMessage {
  const message = typeof error === "string" ? error.toLowerCase() : "";
  if (message.includes("nenhum provedor de imagens")) {
    return ["Nenhum provedor de imagens disponível conseguiu gerar o arquivo. Confira saldo, acesso e disponibilidade dos provedores.", "No available image provider could generate the file. Check provider balances, access and availability.", "Ningún proveedor de imágenes disponible pudo generar el archivo. Revisa saldo, acceso y disponibilidad de los proveedores."];
  }
  if (message.includes("bloqueado por segurança")) {
    return ["O pedido foi bloqueado por segurança. Revise o conceito antes de tentar novamente.", "The request was blocked for safety. Review the concept before retrying.", "La solicitud fue bloqueada por seguridad. Revisa el concepto antes de volver a intentarlo."];
  }
  if (/no credits remaining|insufficient_quota|billing_hard_limit|billing.*limit|quota.*exceeded/.test(message)) {
    return [
      "A conta da API OpenAI está sem saldo ou atingiu o limite de uso. Confira o faturamento da OpenAI; os créditos do NexOS são separados.",
      "The OpenAI API account has no balance or has reached its usage limit. Check OpenAI billing; NexOS credits are separate.",
      "La cuenta de la API de OpenAI no tiene saldo o alcanzó su límite de uso. Revisa la facturación de OpenAI; los créditos de NexOS son independientes.",
    ];
  }
  if (/429|rate.limit|too many requests/.test(message)) {
    return ["O provedor limitou as solicitações. Aguarde e tente novamente.", "The provider rate-limited requests. Wait and try again.", "El proveedor limitó las solicitudes. Espera y vuelve a intentarlo."];
  }
  if (/401|invalid.api.key|api.key.*not.*configured|não configurado/.test(message)) {
    return ["A credencial de geração de imagens precisa ser configurada ou corrigida pelo administrador.", "The administrator needs to configure or correct the image generation credential.", "El administrador debe configurar o corregir la credencial de generación de imágenes."];
  }
  if (/403|must.*verified|organization.*verif/.test(message)) {
    return ["A conta OpenAI precisa de permissão ou verificação para usar o modelo de imagens.", "The OpenAI account needs permission or verification to use the image model.", "La cuenta de OpenAI necesita permiso o verificación para usar el modelo de imágenes."];
  }
  return ["A geração de imagem falhou. O conceito foi preservado; tente novamente ou peça ao administrador para verificar o provedor.", "Image generation failed. The concept was preserved; retry or ask the administrator to check the provider.", "La generación de imagen falló. El concepto se conservó; vuelve a intentarlo o pide al administrador que revise el proveedor."];
}
