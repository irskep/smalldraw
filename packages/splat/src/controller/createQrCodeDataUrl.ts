import QRCode from "qrcode";

export async function createQrCodeDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
