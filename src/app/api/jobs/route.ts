import { NextResponse } from "next/server";
import { getSession } from "@/lib/current-user";
import { createJob } from "@/lib/jobs";
import { readSample } from "@/lib/samples";
import { isDocType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请用表单上传文件。" }, { status: 400 });
  }

  const typeValue = String(form.get("type") ?? "");
  if (!isDocType(typeValue)) return NextResponse.json({ error: "请选择发票、合同或简历。" }, { status: 400 });
  const rewrite = form.get("rewrite") === "1" || form.get("rewrite") === "on";

  let filename = "";
  let bytes: Buffer;
  if (form.get("sample") === "1") {
    const sample = await readSample(typeValue);
    filename = sample.filename;
    bytes = sample.bytes;
  } else {
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "请选择文件，或使用示例。" }, { status: 400 });
    filename = file.name || "upload.txt";
    bytes = Buffer.from(await file.arrayBuffer());
  }

  const created = await createJob({
    userId: session.uid,
    type: typeValue,
    filename,
    bytes,
    rewrite,
  });
  if ("error" in created) {
    return NextResponse.json(
      created.code ? { error: created.error, code: created.code } : { error: created.error },
      { status: created.status },
    );
  }
  return NextResponse.json({ id: created.id });
}
