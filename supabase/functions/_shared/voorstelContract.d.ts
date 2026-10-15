// Typedeclaratie voor voorstelContract.js (byte-identieke kopie van src/features/kompas-app/financiering/voorstel.js).
// Alleen wat de serverketen gebruikt; bewust ruim getypeerd, de echte controle zit in het contract zelf.
export const VOORSTEL_VERSIE: number;
export const MAX_REGELS: number;
export function isEchteDatum(iso: unknown): boolean;
export function veiligeUrl(waarde: unknown): string | null;
export interface ContractRegel {
  type: 'regeling' | 'fonds' | 'online';
  id: string | null;
  naam: string;
  gever: string;
  sleutel: string;
  bedrag: number | null;
  grenzen: { min: number | null; max: number | null };
  selecteerbaar: boolean;
  staatAl: boolean;
  deadline: { status: string; datum: string | null; verlopen: boolean };
  [sleutel: string]: unknown;
}
export interface ContractVoorstel {
  versie: number;
  projectId: string;
  regels: ContractRegel[];
  acties: unknown[];
  nietToegewezen: number;
  [sleutel: string]: unknown;
}
export interface ContractUitkomst {
  ok: boolean;
  voorstel: ContractVoorstel | null;
  fouten: Array<{ pad: string; code: string }>;
  waarschuwingen: Array<{ pad: string; code: string }>;
  geschaald?: boolean;
}
export interface BekendRecord {
  naam: string;
  gever?: string;
  deadline: string | null;
  min: number | null;
  max: number | null;
  cofinanciering?: string | null;
}
export interface ContractContext {
  projectId: string;
  dekking: unknown;
  bestaandeRegels?: Array<{ schemeId?: string | null; funderId?: string | null; naam?: string; financierNaam?: string }>;
  bedragenToegestaan?: boolean;
  vandaag: string;
  bekendeBronnen: Record<string, BekendRecord>;
  opgehaaldeBronnen?: unknown[];
}
export function valideerVoorstel(raw: unknown, ctx: ContractContext): ContractUitkomst;
export function schaalEnControleer(raw: unknown, ctx: ContractContext): ContractUitkomst;
export function berekenTotalen(voorstel: ContractVoorstel | null, dekking: unknown, selectie?: Iterable<string>): Record<string, number>;
