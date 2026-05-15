import QRCode from "qrcode";

/**
 * Pinned spec — tuned for laptop-screen → phone-camera capture:
 * - ECC `M` (~15% recovery) balances density vs forgiveness; higher levels make
 *   the code harder to scan from a screen.
 * - margin 6 modules exceeds the 4-module quiet zone minimum.
 * - high-contrast dark-on-white sidesteps glare and display PWM banding.
 */
const QR_OPTIONS = {
  type: "svg" as const,
  errorCorrectionLevel: "M" as const,
  margin: 6,
  color: { dark: "#0c192f", light: "#FFFFFF" },
  width: 320,
};

export async function renderQrSvg(value: string): Promise<string> {
  return QRCode.toString(value, QR_OPTIONS);
}
