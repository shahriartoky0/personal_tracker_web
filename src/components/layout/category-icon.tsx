import {
  Banknote,
  Bus,
  Clapperboard,
  Ellipsis,
  HeartPulse,
  Laptop,
  Plus,
  Receipt,
  ShoppingBasket,
  Tag,
  User,
  Utensils,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  bus: Bus,
  receipt: Receipt,
  user: User,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  ellipsis: Ellipsis,
  banknote: Banknote,
  laptop: Laptop,
  plus: Plus,
}

export function CategoryIcon({ name, color, className }: { name: string | null; color?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Tag
  return <Icon aria-hidden className={className} style={color ? { color } : undefined} />
}
