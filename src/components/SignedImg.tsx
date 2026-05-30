import { useSignedPhoto, type PhotoBucket } from "@/lib/photo-storage";
import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  bucket?: PhotoBucket;
  fallback?: React.ReactNode;
};

export function SignedImg({ src, bucket, fallback = null, ...rest }: Props) {
  const url = useSignedPhoto(src ?? null, bucket);
  if (!url) return <>{fallback}</>;
  return <img src={url} {...rest} />;
}
