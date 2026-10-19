import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

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

export async function uploadReceiptPhoto(
  orderId: string,
  source: Blob | File | string
): Promise<string> {
  const blob =
    typeof source === 'string'
      ? dataUrlToBlob(source)
      : source instanceof File
        ? source
        : source;

  const fileName = `receipt_${Date.now()}.jpg`;
  const path = `receipts/${orderId}/${fileName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'image/jpeg'
  });

  return getDownloadURL(storageRef);
}
