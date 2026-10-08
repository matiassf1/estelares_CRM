/** Resize + compress an image file to a base64 JPEG string. Max ~150KB output. */
export function compressImage(file: File, maxDim = 400): Promise<string> {
  console.log('[compressImage] start', file.name, file.type, file.size);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('[compressImage] timeout — formato no soportado?', file.type);
      reject(new Error(`Formato no soportado: ${file.type || 'desconocido'}`));
    }, 10_000);

    const reader = new FileReader();
    reader.onerror = (e) => { clearTimeout(timeout); console.warn('[compressImage] FileReader error', e); reject(e); };
    reader.onload = e => {
      console.log('[compressImage] FileReader loaded, creating Image...');
      const img = new Image();
      img.onerror = (e) => { clearTimeout(timeout); console.warn('[compressImage] Image load error', e); reject(new Error('No se pudo cargar la imagen')); };
      img.onload = () => {
        console.log('[compressImage] Image loaded', img.width, 'x', img.height);
        clearTimeout(timeout);
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const result = canvas.toDataURL('image/jpeg', 0.72);
        console.log('[compressImage] done, output size', result.length);
        resolve(result);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
