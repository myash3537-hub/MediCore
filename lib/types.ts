export type UserRole = "admin" | "pharmacist";
export type PaymentMethod = "Cash" | "UPI" | "Card" | "Split";
export type OnlinePaymentMethod = "UPI" | "Card";

export type NavigationItem = {
  title: string;
  href: string;
  icon: "LayoutDashboard" | "Package2" | "ShoppingCart" | "Receipt" | "ClipboardList" | "FileText" | "Users" | "Settings" | "Activity";
  roles?: UserRole[];
  featured?: boolean;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  permissions: string[] | null;
  is_active: boolean;
  created_at?: string | null;
  last_seen_at?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type InventorySnapshotRow = {
  batch_id: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  rx_required: boolean;
  batch_number: string;
  expiry_date: string;
  stock_quantity: number;
  purchase_price: number;
  selling_price: number;
  tablets_per_strip: number;
  low_stock_threshold: number;
  supplier_name?: string | null;
  is_low_stock: boolean;
};

export type StoreSettings = {
  id: string;
  store_name: string;
  store_address?: string | null;
  store_contact?: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  currency_code: string;
  expiry_alert_days: number;
  default_low_stock_threshold: number;
};

export type SaleSummary = {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_name?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  cash_amount?: number;
  online_amount?: number;
  online_payment_method?: OnlinePaymentMethod | null;
};

export type PurchaseSummary = {
  id: string;
  invoice_number?: string | null;
  purchase_date: string;
  subtotal: number;
  total_amount: number;
  supplier_id?: string | null;
  suppliers?: Supplier | null;
};

export type AuditLog = {
  id: string;
  user_id?: string | null;
  entity_name: string;
  entity_id?: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "email"> | null;
};

export type ChartDatum = {
  label: string;
  value: number;
};
