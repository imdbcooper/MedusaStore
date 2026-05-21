import { Container, clx } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: HttpTypes.StoreProduct["images"]
  size?: "small" | "medium" | "large" | "full" | "square"
  aspectRatio?: "portrait" | "feature"
  isFeatured?: boolean
  className?: string
  frameClassName?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  aspectRatio,
  isFeatured,
  className,
  frameClassName,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url
  const resolvedAspectRatio =
    size === "square"
      ? "square"
      : aspectRatio || (isFeatured ? "feature" : "portrait")

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4",
        frameClassName ||
          "border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] shadow-[var(--theme-shadow-card)] rounded-[var(--theme-radius-card)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--theme-shadow-shell)]",
        className,
        {
          "aspect-[11/14]": resolvedAspectRatio === "feature",
          "aspect-[9/16]": resolvedAspectRatio === "portrait",
          "aspect-[1/1]": resolvedAspectRatio === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} />
    </Container>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
}: Pick<ThumbnailProps, "size"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="Thumbnail"
      className="absolute inset-0 object-cover object-center"
      draggable={false}
      quality={50}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
