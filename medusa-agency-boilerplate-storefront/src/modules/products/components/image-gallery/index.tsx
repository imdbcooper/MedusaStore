import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import PlaceholderImage from "@modules/common/icons/placeholder-image"
import Image from "next/image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle?: string
}

const ImageGallery = ({ images, productTitle }: ImageGalleryProps) => {
  const primaryImage = images[0]
  const secondaryImages = images.slice(1, 3)

  return (
    <div className="flex flex-col gap-4">
      <Container className="group relative aspect-[4/3] w-full overflow-hidden rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[0_8px_32px_rgba(23,26,31,0.06)]">
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(230,233,231,0.24)] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            priority
            className="absolute inset-0 object-cover object-center"
            alt={productTitle || "Product image"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 58vw, 820px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--theme-surface-muted)] text-[var(--theme-muted)]">
            <PlaceholderImage size={48} />
          </div>
        )}
      </Container>
      {secondaryImages.length ? (
        <div className="grid grid-cols-2 gap-4">
          {secondaryImages.map((image, index) => (
            <Container
              key={image.id}
              className="relative aspect-[4/3] overflow-hidden rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[0_4px_16px_rgba(23,26,31,0.04)]"
              id={image.id}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  className="absolute inset-0 object-cover object-center"
                  alt={`${productTitle || "Product image"} ${index + 2}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 380px"
                />
              )}
            </Container>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ImageGallery
