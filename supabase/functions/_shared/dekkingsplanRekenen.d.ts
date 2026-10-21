// Typedeclaratie voor dekkingsplanRekenen.js (byte-identieke kopie van src/features/kompas-app/financiering/dekkingsplan.js).
export interface Dekking {
  heeftBegroting: boolean;
  begroting: number;
  gepland: number;
  nogTePlannen: number;
  [sleutel: string]: unknown;
}
export function berekenDekking(inv: { begroting: unknown; regels: unknown[]; overige: unknown }): Dekking;
export function regelUitRpc(rij: unknown): Record<string, unknown>;
