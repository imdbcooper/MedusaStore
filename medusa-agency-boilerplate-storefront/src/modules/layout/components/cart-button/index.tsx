import { retrieveCart } from "@lib/data/cart"
import CartDropdown from "../cart-dropdown"

type CartButtonProps = {
  className?: string
  variant?: "text" | "icon"
}

export default async function CartButton({
  className,
  variant = "text",
}: CartButtonProps) {
  const cart = await retrieveCart().catch(() => null)

  return <CartDropdown cart={cart} className={className} variant={variant} />
}
