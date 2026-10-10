import ExcelJS from "exceljs";
import type { InvoiceData } from "../types";
import { excelSafe } from "./safe";

export async function invoiceToXlsx(data: InvoiceData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "纸匣";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("概览");
  overview.columns = [
    { header: "字段", key: "field", width: 22 },
    { header: "内容", key: "value", width: 42 },
  ];
  overview.addRows([
    { field: "销售方", value: excelSafe(data.merchant) },
    { field: "纳税人识别号", value: excelSafe(data.taxId) },
    { field: "开票日期", value: excelSafe(data.date) },
    { field: "价税合计", value: excelSafe(data.amount) },
    { field: "币种", value: excelSafe(data.currency) },
  ]);
  styleHeader(overview);

  const items = workbook.addWorksheet("明细");
  items.columns = [
    { header: "序号", key: "index", width: 8 },
    { header: "项目", key: "name", width: 32 },
    { header: "数量", key: "quantity", width: 12 },
    { header: "单价", key: "unitPrice", width: 16 },
    { header: "金额", key: "amount", width: 16 },
  ];
  data.lineItems.forEach((item, index) => {
    items.addRow({
      index: index + 1,
      name: excelSafe(item.name),
      quantity: excelSafe(item.quantity),
      unitPrice: excelSafe(item.unitPrice),
      amount: excelSafe(item.amount),
    });
  });
  styleHeader(items);

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF9F2D20" },
  };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
