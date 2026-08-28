import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import type { Attachment } from '../types';
import { uid } from './id';

function kindFromMime(mime: string, name: string): Attachment['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || /\.(txt|md|json|csv|xml|html|js|ts|py|java)$/i.test(name)) return 'text';
  return 'file';
}

async function fromDataUrl(name: string, mime: string, dataUrl: string): Promise<Attachment> {
  const base64 = dataUrl.split(',')[1] ?? '';
  const size = Math.round((base64.length * 3) / 4);
  const kind = kindFromMime(mime, name);
  const att: Attachment = { id: uid('att'), kind, name, mime, size, dataUrl };
  if (kind === 'text') {
    try {
      att.text = atob(base64);
    } catch {
      att.text = '';
    }
  }
  return att;
}

export async function takePhoto(): Promise<Attachment | null> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl,
      quality: 85,
    });
    if (!photo.dataUrl) return null;
    return fromDataUrl(`photo-${Date.now()}.jpg`, photo.format === 'png' ? 'image/png' : 'image/jpeg', photo.dataUrl);
  }
  return pickWithInput('image/*', true);
}

export async function pickImages(): Promise<Attachment[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FilePicker.pickImages({ readData: true });
      const out: Attachment[] = [];
      for (const f of result.files) {
        if (!f.data) continue;
        const mime = f.mimeType || 'image/jpeg';
        const dataUrl = `data:${mime};base64,${f.data}`;
        out.push(await fromDataUrl(f.name || 'image.jpg', mime, dataUrl));
      }
      return out;
    } catch {
      const photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.DataUrl,
        quality: 85,
      });
      if (!photo.dataUrl) return [];
      return [await fromDataUrl(`image-${Date.now()}.jpg`, 'image/jpeg', photo.dataUrl)];
    }
  }
  const one = await pickWithInput('image/*', false);
  return one ? [one] : [];
}

export async function pickFiles(): Promise<Attachment[]> {
  if (Capacitor.isNativePlatform()) {
    const result = await FilePicker.pickFiles({ readData: true });
    const out: Attachment[] = [];
    for (const f of result.files) {
      const mime = f.mimeType || 'application/octet-stream';
      const name = f.name || 'file';
      if (f.data) {
        const dataUrl = `data:${mime};base64,${f.data}`;
        const att = await fromDataUrl(name, mime, dataUrl);
        if (att.kind === 'file' && f.data) {
          try {
            const decoded = atob(f.data);
            if (/^[\x09\x0a\x0d\x20-\x7e\u0100-\uFFFF]*$/.test(decoded.slice(0, 200))) {
              att.kind = 'text';
              att.text = decoded.slice(0, 20000);
            }
          } catch {
            /* keep binary */
          }
        }
        out.push(att);
      }
    }
    return out;
  }
  const one = await pickWithInput('*/*', false);
  return one ? [one] : [];
}

function pickWithInput(accept: string, capture: boolean): Promise<Attachment | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const dataUrl = await readFileDataUrl(file);
      const att = await fromDataUrl(file.name, file.type || 'application/octet-stream', dataUrl);
      if (att.kind !== 'image') {
        att.text = await file.text().catch(() => undefined);
        if (att.text) att.kind = 'text';
      }
      resolve(att);
    };
    input.click();
  });
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function attachmentFromText(name: string, text: string): Promise<Attachment> {
  return {
    id: uid('att'),
    kind: 'text',
    name,
    mime: 'text/plain',
    size: text.length,
    text,
  };
}
