import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type ReceiptCaptureSource = 'camera' | 'gallery';

export interface CapturedReceipt {
  blob: Blob;
  preview: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function isUserCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('cancel') || message.includes('cancelled');
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function captureReceiptImage(
  source: ReceiptCaptureSource
): Promise<CapturedReceipt> {
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    saveToGallery: false,
    correctOrientation: true
  });

  if (!photo.dataUrl) {
    throw new Error('No se pudo obtener la imagen');
  }

  return {
    blob: dataUrlToBlob(photo.dataUrl),
    preview: photo.dataUrl
  };
}

export { isUserCancelled };
