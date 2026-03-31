declare module "html-to-docx" {
  interface DocxOptions {
    title?: string;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    font?: string;
    fontSize?: number;
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    header?: boolean;
    footer?: boolean;
    [key: string]: unknown;
  }

  function HTMLtoDOCX(
    html: string,
    headerHtml: string | undefined,
    options?: DocxOptions,
    footerHtml?: string
  ): Promise<Buffer | Blob | ArrayBuffer>;

  export default HTMLtoDOCX;
}
