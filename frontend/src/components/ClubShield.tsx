import { useState, useEffect } from 'react';

interface Props {
  size?: number;
  className?: string;
  variant?: 'gold' | 'white' | 'original'; // kept for API compat, no longer applied
  style?: React.CSSProperties;
}

// Flood-fill from edges to remove the outer white background.
// Seeds from all border pixels; stops at dark pixels (the crest outline).
// Preserves white design elements inside the crest since they're not edge-reachable.
function removeWhiteBackground(imageData: ImageData): void {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const isLight = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    return data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210;
  };

  const seed = (x: number, y: number) => {
    const k = y * width + x;
    if (!visited[k] && isLight(x, y)) { visited[k] = 1; queue.push(k); }
  };

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

  while (queue.length) {
    const k = queue.shift()!;
    const x = k % width;
    const y = Math.floor(k / width);
    data[k * 4 + 3] = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) seed(nx, ny);
    }
  }
}

let cachedSrc: string | null = null;

export default function ClubShield({ size = 80, className = '', style }: Props) {
  const [src, setSrc] = useState<string>(cachedSrc ?? '/shield.png');

  useEffect(() => {
    if (cachedSrc) { setSrc(cachedSrc); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      removeWhiteBackground(imageData);
      ctx.putImageData(imageData, 0, 0);
      cachedSrc = canvas.toDataURL('image/png');
      setSrc(cachedSrc);
    };
    img.src = '/shield.png';
  }, []);

  return (
    <img
      src={src}
      alt="Estelares Futsal"
      width={size}
      height={size}
      className={`object-contain select-none ${className}`}
      style={style}
      draggable={false}
    />
  );
}
