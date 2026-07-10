import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { renderContractDocx } from "@/lib/contract-docx-render"
import { CORDIA_FONT_CSS } from "@/components/cordia-font"
import type { DocxType } from "@/lib/contract-docx"

export const runtime = "nodejs"
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME

async function asset(rel: string) {
  return readFile(path.join(process.cwd(), "lib", "pdf-assets", rel), "utf8")
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const type = (req.nextUrl.searchParams.get("type") ?? "sale") as DocxType

  // 1) สร้าง .docx (ตัวเดียวกับปุ่มโหลด .docx — PDF จึงตรงกับ docx เป๊ะ)
  const docx = await renderContractDocx(id, type)
  if (!docx) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [jszip, docxPreview] = await Promise.all([
    asset("jszip.min.js"),
    asset("docx-preview.min.js"),
  ])
  const b64 = docx.buffer.toString("base64")

  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  ${CORDIA_FONT_CSS}
  html,body{margin:0;padding:0;background:#fff}
  /* ตัดพื้นเทา/เงา/ระยะขอบของ wrapper — เหลือแต่หน้ากระดาษล้วนให้พิมพ์สะอาด */
  .docx-wrapper{background:#fff!important;padding:0!important;display:block!important}
  .docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto!important}
</style></head><body><div id="c"></div></body></html>`

  let browser
  try {
    browser = await puppeteer.launch(
      isServerless
        ? {
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
          }
        : {
            args: ["--no-sandbox", "--font-render-hinting=none"],
            executablePath:
              process.env.LOCAL_CHROME_PATH ||
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            headless: true,
          },
    )
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.addScriptTag({ content: jszip })
    await page.addScriptTag({ content: docxPreview })
    await page.evaluate(
      async (data: string) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        // @ts-expect-error global จาก script ที่ inject
        await window.docx.renderAsync(bytes.buffer, document.getElementById("c"), null, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          experimental: true,
          useBase64URL: true,
        })
      },
      b64,
    )
    // เผื่อฟอนต์/รูปโหลดเสร็จ
    await page.evaluateHandle("document.fonts.ready")

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })

    const filename = docx.filename.replace(/\.docx$/, ".pdf")
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pdf error"
    return NextResponse.json({ error: "pdf generation failed", detail: msg }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
