import {
  Banknote,
  Bike,
  Cigarette,
  Coffee,
  GraduationCap,
  Gift,
  House,
  Shirt,
  Smartphone,
  Store,
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
  coffee: Coffee,
  bike: Bike,
  cigarette: Cigarette,
  smartphone: Smartphone,
  house: House,
  "graduation-cap": GraduationCap,
  shirt: Shirt,
  gift: Gift,
  store: Store,
}

export function CategoryIcon({ name, color, className }: { name: string | null; color?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Tag
  return <Icon aria-hidden className={className} style={color ? { color } : undefined} />
}
