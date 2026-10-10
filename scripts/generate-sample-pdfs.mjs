import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf({ lines, drawOnly }) {
  const commands = [];
  if (drawOnly) {
    commands.push("0.93 0.91 0.88 rg", "50 180 512 480 re f", "0.62 0.56 0.5 RG", "1.5 w", "50 180 512 480 re S");
  } else {
    commands.push("BT", "/F1 16 Tf", "72 740 Td", `(${escapePdfText(lines[0])}) Tj`, "/F1 12 Tf");
    for (const line of lines.slice(1)) {
      commands.push("0 -22 Td", `(${escapePdfText(line)}) Tj`);
    }
    commands.push("ET");
  }
  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer);
}

const invoice = buildPdf({
  lines: [
    "INVOICE",
    "Merchant: Northwind Trading LLC",
    "Tax ID: 12-3456789",
    "Invoice Date: 2026-01-20",
    "Total: $1,250.00",
    "Line items:",
    "1. Consulting hours | qty 10 | unit 100.00 | amount 1000.00",
    "2. Travel expenses | qty 1 | unit 250.00 | amount 250.00",
  ],
});

const scanned = buildPdf({ drawOnly: true, lines: [] });

writeFileSync(join(root, "samples", "invoice-en.pdf"), invoice);
writeFileSync(join(root, "samples", "scanned-no-text.pdf"), scanned);
console.log("wrote samples/invoice-en.pdf and samples/scanned-no-text.pdf");
