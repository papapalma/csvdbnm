import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

const RENDER_SIZE = 300; // internal canvas resolution — always crisp

export default function QRCodeDisplay({ value, size, className = '' }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: RENDER_SIZE,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    }
  }, [value]);

  // If size is given use it explicitly; otherwise fill the container via CSS
  const style = size
    ? { width: size, height: size }
    : { width: '100%', height: 'auto' };

  return <canvas ref={canvasRef} className={className} style={style} />;
}
