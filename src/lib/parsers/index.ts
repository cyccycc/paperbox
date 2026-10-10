import { parseContract } from "./contract";
import { parseInvoice } from "./invoice";
import { parseResume } from "./resume";
import type { DocType, ExtractionData } from "../types";

export function parseOffline(type: DocType, text: string, rewrite: boolean): ExtractionData {
  if (type === "invoice") return parseInvoice(text);
  if (type === "contract") return parseContract(text);
  return parseResume(text, rewrite);
}
