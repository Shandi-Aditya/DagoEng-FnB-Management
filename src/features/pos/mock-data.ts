import { POSProductItem, LoyaltyMemberProfile, LoyaltyVoucher } from "./types";

export const LOYALTY_MEMBERS: LoyaltyMemberProfile[] = [
  { id: "mem-1", name: "Ketut Dian", phone: "+62 819-1122-3344", tier: "Gold", points: 340 },
  { id: "mem-2", name: "Ahmad Faisal", phone: "+62 812-7766-5544", tier: "Silver", points: 180 },
  { id: "mem-3", name: "Siti Rahma", phone: "+62 818-4455-6677", tier: "Silver", points: 120 },
  { id: "mem-4", name: "Dewi Lestari", phone: "+62 813-2233-4455", tier: "Bronze", points: 75 },
  { id: "mem-5", name: "Budi Santoso", phone: "+62 857-9988-7766", tier: "Bronze", points: 40 },
];

export const LOYALTY_VOUCHERS: LoyaltyVoucher[] = [
  {
    id: "vouch-1",
    title: "Voucher Potongan Rp 25.000",
    description: "Potongan langsung Rp 25.000 untuk total belanja.",
    pointsCost: 100,
    discountType: "FIXED",
    discountValue: 25000,
  },
  {
    id: "vouch-2",
    title: "Voucher Free Butter Croissant (Rp 20.000)",
    description: "Gratis 1 pcs Butter Croissant Prancis.",
    pointsCost: 150,
    discountType: "FIXED",
    discountValue: 20000,
  },
  {
    id: "vouch-3",
    title: "Diskon Khusus Member Gold 15%",
    description: "Diskon eksklusif 15% tanpa minimum belanja.",
    pointsCost: 0, // Free perk for Gold Tier
    discountType: "PERCENT",
    discountValue: 15,
    minTier: "Gold",
  },
  {
    id: "vouch-4",
    title: "Voucher Potongan Rp 50.000",
    description: "Potongan Rp 50.000 untuk pesanan di atas Rp 100.000.",
    pointsCost: 200,
    discountType: "FIXED",
    discountValue: 50000,
  },
  {
    id: "vouch-cwk-1",
    title: "Kupon Member Co-working 15% (Monthly Flexi)",
    description: "Benefit eksklusif komunitas Dago Co-Working Space.",
    pointsCost: 0,
    discountType: "PERCENT",
    discountValue: 15,
  },
  {
    id: "vouch-cwk-2",
    title: "Kupon Resident Member Co-working 20%",
    description: "Diskon 20% khusus Resident Dedicated Desk Dago Hub.",
    pointsCost: 0,
    discountType: "PERCENT",
    discountValue: 20,
  },
];

export const POS_PRODUCTS: POSProductItem[] = [
  {
    id: "prod-1",
    name: "Kopi Senja Aren",
    basePrice: 24000,
    category: "Signature Coffee",
    description: "Espresso robusta & arabica blend dengan susu segar dan gula aren murni Bali.",
    isAvailable: true,
    variants: [
      { name: "Regular (250ml)", priceAdjustment: 0 },
      { name: "Large (400ml)", priceAdjustment: 5000 },
      { name: "1 Liter Bottle", priceAdjustment: 55000 },
    ],
    modifierGroups: [
      {
        id: "mod-temp",
        name: "Pilihan Suhu",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Dingin (Iced)", price: 0 },
          { name: "Panas (Hot)", price: 0 },
        ],
      },
      {
        id: "mod-sugar",
        name: "Level Gula",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Normal Sugar (100%)", price: 0 },
          { name: "Less Sugar (50%)", price: 0 },
          { name: "No Sugar (0%)", price: 0 },
        ],
      },
      {
        id: "mod-addon",
        name: "Tambahan / Add-ons",
        isRequired: false,
        minSelect: 0,
        maxSelect: 3,
        options: [
          { name: "Extra Espresso Shot", price: 6000 },
          { name: "Ganti Susu Oat (Oat Milk)", price: 8000 },
          { name: "Grass Jelly Topping", price: 4000 },
        ],
      },
    ],
  },
  {
    id: "prod-2",
    name: "Artisan Peach White Tea",
    basePrice: 28000,
    category: "Artisan Tea",
    description: "Seduhan teh putih organik dengan infused buah persik dan madu bunga liar.",
    isAvailable: true,
    variants: [
      { name: "Regular Cup", priceAdjustment: 0 },
      { name: "Teapot (Dine-in Only)", priceAdjustment: 12000 },
    ],
    modifierGroups: [
      {
        id: "mod-temp-tea",
        name: "Pilihan Suhu",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Dingin (Iced)", price: 0 },
          { name: "Panas (Hot Pot)", price: 0 },
        ],
      },
      {
        id: "mod-addon-tea",
        name: "Extra Topping",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: "Chia Seeds", price: 4000 },
          { name: "Honey Jelly", price: 5000 },
        ],
      },
    ],
  },
  {
    id: "prod-3",
    name: "Classic Americano",
    basePrice: 22000,
    category: "Signature Coffee",
    description: "Double shot espresso Kintamani arabica dengan air mineral bersuhu pas.",
    isAvailable: true,
    variants: [
      { name: "Regular", priceAdjustment: 0 },
      { name: "Large", priceAdjustment: 4000 },
    ],
    modifierGroups: [
      {
        id: "mod-temp-ame",
        name: "Pilihan Suhu",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Dingin (Iced)", price: 0 },
          { name: "Panas (Hot)", price: 0 },
        ],
      },
      {
        id: "mod-beans",
        name: "Pilihan Beans",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "House Blend (Singaraja Roast)", price: 0 },
          { name: "Single Origin Flores Bajawa (+Rp 5k)", price: 5000 },
        ],
      },
    ],
  },
  {
    id: "prod-4",
    name: "Iced Caramel Macchiato",
    basePrice: 32000,
    category: "Signature Coffee",
    description: "Espresso lapis dengan vanila sirup, susu dingin, dan drizzle karamel gurih.",
    isAvailable: true,
    variants: [
      { name: "Regular", priceAdjustment: 0 },
      { name: "Large", priceAdjustment: 6000 },
    ],
    modifierGroups: [
      {
        id: "mod-sugar-cm",
        name: "Tingkat Manis",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Normal Sweet", price: 0 },
          { name: "Less Sweet (50%)", price: 0 },
        ],
      },
      {
        id: "mod-addon-cm",
        name: "Tambahan",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: "Extra Caramel Drizzle", price: 4000 },
          { name: "Extra Whipped Cream", price: 5000 },
          { name: "Sub Oat Milk", price: 8000 },
        ],
      },
    ],
  },
  {
    id: "prod-5",
    name: "Signature Wagyu Beef Bowl",
    basePrice: 65000,
    category: "Main Course",
    description: "Daging wagyu iris tipis dengan saus manis gurih khas Dago dan telur onsen.",
    isAvailable: true,
    variants: [
      { name: "Porsi Regular", priceAdjustment: 0 },
      { name: "Double Wagyu Meat", priceAdjustment: 30000 },
    ],
    modifierGroups: [
      {
        id: "mod-egg",
        name: "Tingkat Kematangan Telur",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Onsen Egg (Setengah Matang)", price: 0 },
          { name: "Telur Ceplok Matang", price: 0 },
          { name: "Tanpa Telur", price: 0 },
        ],
      },
      {
        id: "mod-spicy",
        name: "Level Pedas",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Tidak Pedas (Original)", price: 0 },
          { name: "Pedas Sedang (Chili Flakes)", price: 0 },
          { name: "Extra Pedas (Sambal Matah)", price: 3000 },
        ],
      },
    ],
  },
  {
    id: "prod-6",
    name: "Flaky French Butter Croissant",
    basePrice: 20000,
    category: "Pastry",
    description: "Croissant panggang mentega Prancis dengan tekstur luar renyah dan lembut di dalam.",
    isAvailable: true,
    variants: [
      { name: "Plain Butter", priceAdjustment: 0 },
      { name: "Almond Croissant", priceAdjustment: 8000 },
      { name: "Pain au Chocolat", priceAdjustment: 6000 },
    ],
    modifierGroups: [
      {
        id: "mod-toast",
        name: "Penyajian",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Hangatkan (Warm/Toasted)", price: 0 },
          { name: "Suhu Ruang (Normal)", price: 0 },
        ],
      },
      {
        id: "mod-dip",
        name: "Extra Dipping",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: "Nutella Dip", price: 5000 },
          { name: "Strawberry Jam", price: 4000 },
        ],
      },
    ],
  },
  {
    id: "prod-7",
    name: "Truffle Parmesan Fries",
    basePrice: 32000,
    category: "Snacks",
    description: "Kentang goreng renyah dengan minyak truffle aromatik dan taburan keju parmesan.",
    isAvailable: true,
    modifierGroups: [
      {
        id: "mod-sauce",
        name: "Pilihan Saus",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: "Truffle Mayo (Default)", price: 0 },
          { name: "Spicy Sambal Bangkok", price: 0 },
          { name: "Extra Cheese Sauce", price: 5000 },
        ],
      },
    ],
  },
];
