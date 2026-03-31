import HTMLtoDOCX from "html-to-docx";

export async function generateDocx(html: string, title: string): Promise<Buffer> {
  const docxBuffer = await HTMLtoDOCX(html, undefined, {
    title,
    margin: {
      top: 720,
      right: 900,
      bottom: 720,
      left: 900,
    },
    font: "Calibri",
    fontSize: 22,
    table: { row: { cantSplit: true } },
    header: false,
    footer: false,
  });
  return Buffer.from(docxBuffer as ArrayBuffer);
}
