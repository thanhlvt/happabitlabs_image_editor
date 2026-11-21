export interface LoadedImageData {
  src: string;
  name: string;
  width: number;
  height: number;
}

/**
 * Read a local image File into a Data URL and resolve its natural dimensions.
 */
export function readLocalImageFile(file: File): Promise<LoadedImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          src,
          name: file.name.replace(/\.[^/.]+$/, '') || 'Image',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      img.onerror = () => reject(new Error(`Không thể đọc ảnh: ${file.name}`));
      img.src = src;
    };
    reader.onerror = () => reject(new Error(`Lỗi đọc file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Load an HTMLImageElement from a src string.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image element'));
    img.src = src;
  });
}

/**
 * Trigger a browser download for a Blob or Data URL.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
