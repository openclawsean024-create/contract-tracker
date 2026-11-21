// mammoth 的獨立瀏覽器 bundle 沒有附型別，這裡只宣告本專案用到的介面。
declare module "mammoth/mammoth.browser" {
  interface MammothBrowser {
    extractRawText(input: {
      arrayBuffer: ArrayBuffer;
    }): Promise<{ value: string; messages: unknown[] }>;
  }
  const mammoth: MammothBrowser;
  export default mammoth;
}
