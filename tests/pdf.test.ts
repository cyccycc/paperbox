import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseInvoice } from "../src/lib/parsers/invoice";
import { readSource } from "../src/lib/read-source";
import { NO_TEXT_MESSAGE } from "../src/lib/types";

const samples = path.join(process.cwd(), "samples");

test("English invoice PDF has a text layer the parser can read", async () => {
  const bytes = readFileSync(path.join(samples, "invoice-en.pdf"));
  const read = await readSource("invoice-en.pdf", bytes);
  assert.equal(read.ok, true);
  if (!read.ok) return;
  assert.match(read.text, /Northwind Trading LLC/);
  const invoice = parseInvoice(read.text);
  assert.equal(invoice.merchant, "Northwind Trading LLC");
  assert.equal(invoice.taxId, "12-3456789");
  assert.equal(invoice.amount, "$1,250.00");
  assert.equal(invoice.lineItems.length, 2);
});

test("a PDF without selectable text explains the limitation", async () => {
  const bytes = readFileSync(path.join(samples, "scanned-no-text.pdf"));
  const read = await readSource("scanned-no-text.pdf", bytes);
  assert.equal(read.ok, false);
  if (read.ok) return;
  assert.equal(read.code, "no_text");
  assert.equal(read.message, NO_TEXT_MESSAGE);
  assert.match(read.message, /TXT/);
  assert.match(read.message, /Markdown/);
});
