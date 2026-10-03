const LABELED_SECRET =
  /\b(access[_ -]?token|refresh[_ -]?token|api[_ -]?key|secret[_ -]?key|client[_ -]?secret|developer[_ -]?token|bot[_ -]?token)\b\s*[:=]\s*["']?([^\s"'`<>]{8,})/gi;

const SECRET_PREFIXES = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}\b/gi,
  /\bEAA[A-Za-z0-9]{16,}\b/g,
  /\b(?:sk_(?:live|test|prod)_|re_|pat-|APP_USR-|act\.)[A-Za-z0-9._$-]{8,}\b/g,
  /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g,
];

const LEGACY_CREDENTIAL_BLOCK =
  /CREDENCIAIS_DETECTADAS[\s\S]*?(?=\n\s*\n|$)/gi;

export function containsLikelyIntegrationCredential(value: string): boolean {
  LABELED_SECRET.lastIndex = 0;
  if (LABELED_SECRET.test(value)) return true;
  return SECRET_PREFIXES.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function redactIntegrationCredentials(value: string): string {
  let redacted = value.replace(
    LEGACY_CREDENTIAL_BLOCK,
    "[BLOCO DE CREDENCIAIS REMOVIDO]",
  );
  redacted = redacted.replace(
    LABELED_SECRET,
    (_match, label: string) => `${label}: [REMOVIDO]`,
  );
  for (const pattern of SECRET_PREFIXES) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[CREDENCIAL REMOVIDA]");
  }
  return redacted;
}

export const INTEGRATION_CREDENTIAL_BLOCK_MESSAGE =
  "Não envie tokens, chaves, senhas ou screenshots que possam exibi-los ao assistente. Informe credenciais somente no formulário protegido da integração ou use OAuth.";
