import { toBlob } from "html-to-image";

export async function captureElementAsPng(element: HTMLElement): Promise<Blob> {
  const blob = await toBlob(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
    // Skip interactive controls that shouldn't appear on the shared image
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Share summary image via the system share sheet (WhatsApp on mobile)
 * or download the PNG as fallback (desktop browsers).
 */
export async function shareSummaryImage(params: {
  element: HTMLElement;
  filename?: string;
  title?: string;
  text?: string;
}): Promise<"shared" | "downloaded"> {
  const filename = params.filename ?? "roteirobr-resumo.png";
  const blob = await captureElementAsPng(params.element);
  const file = new File([blob], filename, { type: "image/png" });

  const shareData: ShareData = {
    files: [file],
    title: params.title ?? "RoteiroBR",
    text: params.text ?? "Resumo da viagem — RoteiroBR",
  };

  if (
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare(shareData))
  ) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      // User cancelled the share sheet — not an error.
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      // Fall through to download if share failed for another reason.
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}
