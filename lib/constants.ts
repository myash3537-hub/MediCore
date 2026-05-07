import { NavigationItem } from "@/lib/types";

export const navItems: NavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", featured: true },
  { title: "Inventory", href: "/inventory", icon: "Package2" },
  { title: "POS Billing", href: "/billing", icon: "ShoppingCart" },
  { title: "Purchases", href: "/purchases", icon: "Receipt", roles: ["admin"] },
  { title: "Returns", href: "/returns", icon: "ClipboardList" },
  { title: "Reports", href: "/reports", icon: "FileText" },
  { title: "Users", href: "/users", icon: "Users", roles: ["admin"] },
  { title: "Settings", href: "/settings", icon: "Settings", roles: ["admin"] },
  { title: "Activity", href: "/dashboard#activity", icon: "Activity", roles: ["admin"] }
];

export const medicineCategories = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Ointment",
  "Drops",
  "Powder",
  "Device",
  "Supplement",
  "Other"
] as const;

export const paymentMethods = ["Cash", "UPI", "Card", "Split"] as const;

export const defaultPermissions = {
  admin: ["inventory:write", "sales:write", "purchases:write", "returns:write", "reports:read", "settings:write", "users:write"],
  pharmacist: ["inventory:write", "sales:write", "returns:write", "reports:read"]
} as const;
