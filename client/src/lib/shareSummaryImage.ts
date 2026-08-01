import { toBlob } from "html-to-image";

export type WhatsAppShareResult = {
  roundTrip: boolean;
  originAddress: string;
  destinationAddress: string;
  distanceKm: number;
  durationText: string;
  fuelCost: number;
  tollCost: number;
  totalCost: number;
  estimatedTollPlazas: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDistance = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value) + " km";

/**
 * Detect mobile / tablet clients where WhatsApp can receive image shares.
 * Desktop browsers (incl. WhatsApp Web) fall back to text links.
 */
export function isMobileClient(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const uaDataMobile = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData?.mobile;

  if (typeof uaDataMobile === "boolean") {
    return uaDataMobile;
  }

  // iPadOS 13+ may report as Macintosh; combine with touch points.
  const iPadDesktopUa =
    /Macintosh/i.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    iPadDesktopUa
  );
}

export function buildWhatsAppShareText(result: WhatsAppShareResult): string {
  const tripType = result.roundTrip ? "Ida e volta" : "Somente ida";
  return [
    "*RoteiroBR — Resumo da viagem*",
    "",
    `📍 ${result.originAddress}`,
    `➡️ ${result.destinationAddress}`,
    `🔁 ${tripType}`,
    "",
    `🛣️ Distância: ${formatDistance(result.distanceKm)}`,
    `⏱️ Tempo estimado: ${result.durationText}`,
    `⛽ Combustível: ${formatCurrency(result.fuelCost)}`,
    `💵 Pedágios: ${formatCurrency(result.tollCost)}${
      result.estimatedTollPlazas > 0
        ? ` (${result.estimatedTollPlazas} ${
            result.estimatedTollPlazas === 1 ? "praça" : "praças"
          })`
        : ""
    }`,
    "",
    `💰 *Custo total: ${formatCurrency(result.totalCost)}*`,
  ].join("\n");
}

export function openWhatsAppWithText(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function captureElementAsPng(element: HTMLElement): Promise<Blob> {
  const blob = await toBlob(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.dataset.shareExclude;
    },
  });

  if (!blob) {
    throw new Error("Não foi possível gerar a imagem do resumo.");
  }

  return blob;
}

async function shareSummaryImage(params: {
  element: HTMLElement;
  filename?: string;
  title?: string;
  text?: string;
}): Promise<"shared"> {
  const filename = params.filename ?? "roteirobr-resumo.png";
  const blob = await captureElementAsPng(params.element);
  const file = new File([blob], filename, { type: "image/png" });

  const shareData: ShareData = {
    files: [file],
    title: params.title ?? "RoteiroBR",
    text: params.text ?? "Resumo da viagem — RoteiroBR",
  };

  if (
    typeof navigator.share !== "function" ||
    (navigator.canShare && !navigator.canShare(shareData))
  ) {
    // Rare mobile edge case: share API unavailable — fall back to text.
    throw new Error("SHARE_IMAGE_UNAVAILABLE");
  }

  await navigator.share(shareData);
  return "shared";
}

/**
 * Desktop / WhatsApp Web → text link.
 * Mobile → image via system share sheet (WhatsApp).
 */
export async function shareTripViaWhatsApp(params: {
  result: WhatsAppShareResult;
  element: HTMLElement | null;
}): Promise<"text" | "image"> {
  if (!isMobileClient()) {
    openWhatsAppWithText(buildWhatsAppShareText(params.result));
    return "text";
  }

  if (!params.element) {
    openWhatsAppWithText(buildWhatsAppShareText(params.result));
    return "text";
  }

  try {
    await shareSummaryImage({
      element: params.element,
      filename: "roteirobr-resumo.png",
      title: "RoteiroBR — Resumo da viagem",
      text: `${params.result.originAddress} → ${params.result.destinationAddress}`,
    });
    return "image";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    // If image share fails on mobile, fall back to WhatsApp text.
    openWhatsAppWithText(buildWhatsAppShareText(params.result));
    return "text";
  }
}
