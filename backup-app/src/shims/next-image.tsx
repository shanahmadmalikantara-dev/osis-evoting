import type { CSSProperties } from "react";

// Stand-in for next/image in the backup app: photos are data URLs stored on the laptop.
type Props = {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
  unoptimized?: boolean;
  priority?: boolean;
};

export default function Image({ src, alt, fill, className, width, height }: Props) {
  const style: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : undefined;
  return <img src={src} alt={alt} className={className} style={style} width={width} height={height} draggable={false} />;
}
