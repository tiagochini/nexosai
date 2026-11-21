export function isTrialSaleBlocked(trial: boolean, blocked: readonly string[], id: string): boolean {

  return trial && blocked.includes(id);

}

