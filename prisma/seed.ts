import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Retail Shop Billing OS...');

  // 1. Organization / Shop Profile
  const org = await prisma.organization.upsert({
    where: { id: 'demo-shop-001' },
    update: {},
    create: {
      id: 'demo-shop-001',
      name: 'Ameen Supermarket & Department Store',
      phone: '+91 98450 12345',
      email: 'contact@ameenshop.in',
      gstin: '29ABCDE1234F1Z5',
      currency: 'INR',
      paperSize: '80mm',
      receiptHeader: 'AMEEN SUPERMARKET\nMain Road, City Center\nGSTIN: 29ABCDE1234F1Z5',
      receiptFooter: 'Thank you for shopping with Ameen Supermarket!\nVisit Again • Follow @ameenshop',
      address: {
        line1: 'Shop #12-14, City Grand Plaza',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
      },
      bankDetails: {
        upiId: 'ameenmarket@hdfcbank',
        bankName: 'HDFC Bank Ltd',
        accountNumber: '50200088991122',
        ifsc: 'HDFC0000123',
      },
    },
  });

  // 2. Bill Number Sequence
  await prisma.saleSequence.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      year: new Date().getFullYear(),
      lastNum: 100,
    },
  });

  // 3. Staff Users
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const existingOwner = await prisma.user.findFirst({ where: { email: 'owner@acme.com' } });
  if (existingOwner) {
    await prisma.user.update({
      where: { id: existingOwner.id },
      data: { orgId: org.id, name: 'Mohammed Shafi', role: 'OWNER', passwordHash },
    });
  } else {
    await prisma.user.create({
      data: {
        orgId: org.id,
        name: 'Mohammed Shafi',
        email: 'owner@acme.com',
        passwordHash,
        role: 'OWNER',
      },
    });
  }

  const existingAccountant = await prisma.user.findFirst({ where: { email: 'accountant@acme.com' } });
  if (existingAccountant) {
    await prisma.user.update({
      where: { id: existingAccountant.id },
      data: { orgId: org.id, name: 'Priya Cashier', role: 'CASHIER', passwordHash },
    });
  } else {
    await prisma.user.create({
      data: {
        orgId: org.id,
        name: 'Priya Cashier',
        email: 'accountant@acme.com',
        passwordHash,
        role: 'CASHIER',
      },
    });
  }

  // 4. Shop Product Categories
  const categoriesData = [
    { id: 'cat-groceries', name: 'Groceries & Staples', color: '#16a34a', sortOrder: 1 },
    { id: 'cat-dairy', name: 'Dairy & Eggs', color: '#3b82f6', sortOrder: 2 },
    { id: 'cat-beverages', name: 'Beverages & Soft Drinks', color: '#e05c2b', sortOrder: 3 },
    { id: 'cat-snacks', name: 'Snacks & Biscuits', color: '#d97706', sortOrder: 4 },
    { id: 'cat-personal', name: 'Personal & Home Care', color: '#8b5cf6', sortOrder: 5 },
    { id: 'cat-bakery', name: 'Bakery & Sweets', color: '#ec4899', sortOrder: 6 },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { orgId_name: { orgId: org.id, name: cat.name } },
      update: {},
      create: {
        id: cat.id,
        orgId: org.id,
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder,
      },
    });
  }

  // 5. Products Catalog with barcodes, selling price, cost price, stock, GST
  const productsData = [
    // Groceries
    { name: 'Basmati Rice 5kg (Premium)', barcode: '890103001', categoryId: 'cat-groceries', price: 42000, costPrice: 35000, stock: 45, unit: 'bag', taxRate: 0 },
    { name: 'Sunflower Cooking Oil 1L', barcode: '890103002', categoryId: 'cat-groceries', price: 14500, costPrice: 12500, stock: 60, unit: 'ltr', taxRate: 500 },
    { name: 'Wheat Flour / Atta 10kg', barcode: '890103003', categoryId: 'cat-groceries', price: 38000, costPrice: 32000, stock: 35, unit: 'bag', taxRate: 0 },
    { name: 'Toor Dal 1kg', barcode: '890103004', categoryId: 'cat-groceries', price: 16000, costPrice: 13500, stock: 50, unit: 'kg', taxRate: 0 },
    { name: 'Refined Sugar 1kg', barcode: '890103005', categoryId: 'cat-groceries', price: 4600, costPrice: 4000, stock: 120, unit: 'kg', taxRate: 500 },

    // Dairy
    { name: 'Fresh Farm Milk 500ml', barcode: '890204001', categoryId: 'cat-dairy', price: 3000, costPrice: 2600, stock: 80, unit: 'pkt', taxRate: 0 },
    { name: 'Amul Butter 500g', barcode: '890204002', categoryId: 'cat-dairy', price: 27500, costPrice: 24500, stock: 25, unit: 'pcs', taxRate: 1200 },
    { name: 'Farm Eggs (Tray 30 pcs)', barcode: '890204003', categoryId: 'cat-dairy', price: 21000, costPrice: 17500, stock: 40, unit: 'tray', taxRate: 0 },
    { name: 'Cottage Cheese / Paneer 200g', barcode: '890204004', categoryId: 'cat-dairy', price: 9500, costPrice: 7800, stock: 30, unit: 'pkt', taxRate: 500 },

    // Beverages
    { name: 'Brooke Bond Red Label Tea 500g', barcode: '890305001', categoryId: 'cat-beverages', price: 24000, costPrice: 20500, stock: 40, unit: 'box', taxRate: 500 },
    { name: 'Bru Instant Coffee 100g', barcode: '890305002', categoryId: 'cat-beverages', price: 18500, costPrice: 15500, stock: 35, unit: 'jar', taxRate: 1800 },
    { name: 'Coca-Cola 750ml PET', barcode: '890305003', categoryId: 'cat-beverages', price: 4500, costPrice: 3600, stock: 95, unit: 'btl', taxRate: 2800 },
    { name: 'Sprite Lemon Lime 750ml', barcode: '890305004', categoryId: 'cat-beverages', price: 4500, costPrice: 3600, stock: 70, unit: 'btl', taxRate: 2800 },
    { name: 'Real Mango Fruit Juice 1L', barcode: '890305005', categoryId: 'cat-beverages', price: 12000, costPrice: 9800, stock: 45, unit: 'tetrapak', taxRate: 1200 },

    // Snacks
    { name: 'Lay\'s Classic Salted 50g', barcode: '890406001', categoryId: 'cat-snacks', price: 2000, costPrice: 1600, stock: 150, unit: 'pkt', taxRate: 1200 },
    { name: 'Kurkure Masala Munch 80g', barcode: '890406002', categoryId: 'cat-snacks', price: 2000, costPrice: 1600, stock: 120, unit: 'pkt', taxRate: 1200 },
    { name: 'Oreo Original Cream 120g', barcode: '890406003', categoryId: 'cat-snacks', price: 3500, costPrice: 2900, stock: 90, unit: 'pkt', taxRate: 1800 },
    { name: 'Haldiram\'s Bhujia 400g', barcode: '890406004', categoryId: 'cat-snacks', price: 11000, costPrice: 8800, stock: 50, unit: 'pkt', taxRate: 1200 },
    { name: 'Parle-G Gold Biscuits 200g', barcode: '890406005', categoryId: 'cat-snacks', price: 2500, costPrice: 2100, stock: 110, unit: 'pkt', taxRate: 500 },

    // Bakery
    { name: 'Sliced Sandwich Bread 400g', barcode: '890507001', categoryId: 'cat-bakery', price: 4500, costPrice: 3600, stock: 28, unit: 'loaf', taxRate: 0 },
    { name: 'Chocolate Muffin (Pack of 2)', barcode: '890507002', categoryId: 'cat-bakery', price: 6000, costPrice: 4200, stock: 18, unit: 'pkt', taxRate: 1800 },

    // Personal Care
    { name: 'Dettol Original Soap 125g (Pack of 3)', barcode: '890608001', categoryId: 'cat-personal', price: 16500, costPrice: 13800, stock: 40, unit: 'pkt', taxRate: 1800 },
    { name: 'Colgate Strong Teeth 200g', barcode: '890608002', categoryId: 'cat-personal', price: 11500, costPrice: 9500, stock: 65, unit: 'pcs', taxRate: 1800 },
    { name: 'Head & Shoulders Shampoo 340ml', barcode: '890608003', categoryId: 'cat-personal', price: 32000, costPrice: 26500, stock: 22, unit: 'btl', taxRate: 1800 },
  ];

  for (const p of productsData) {
    await prisma.product.upsert({
      where: { orgId_barcode: { orgId: org.id, barcode: p.barcode } },
      update: {},
      create: {
        orgId: org.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.barcode,
        categoryId: p.categoryId,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        minStock: 10,
        unit: p.unit,
        taxRate: p.taxRate,
      },
    });
  }

  // 6. Regular Customers
  const customers = [
    { name: 'Ameen Retailer', phone: '+91 99001 12233', address: 'Plot 44, 2nd Cross, Bangalore' },
    { name: 'Al-Farooq Hotel & Mess', phone: '+91 98860 44556', address: 'Commercial Road, Bangalore' },
    { name: 'Suhail Ahmed (Regular)', phone: '+91 97410 77889', address: 'Apartment 2B, Green Palms' },
  ];

  for (const c of customers) {
    await prisma.customer.create({
      data: {
        orgId: org.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
      },
    });
  }

  // 7. Seed Past Sales for Analytics & Reports
  const allProducts = await prisma.product.findMany({ where: { orgId: org.id } });
  const methods = ['CASH', 'UPI', 'CARD'] as const;

  console.log('Generating sample retail sales for today and past days...');
  const now = new Date();

  for (let i = 1; i <= 15; i++) {
    const saleNum = `BILL-${now.getFullYear()}-${String(i).padStart(4, '0')}`;
    const p1 = allProducts[i % allProducts.length];
    const p2 = allProducts[(i + 3) % allProducts.length];

    const q1 = (i % 3) + 1;
    const q2 = (i % 2) + 1;

    const line1Total = q1 * p1.price;
    const line2Total = q2 * p2.price;
    const subtotal = line1Total + line2Total;
    const taxTotal = Math.round((line1Total * p1.taxRate + line2Total * p2.taxRate) / 10000);
    const total = subtotal + taxTotal;
    const costTotal = (q1 * p1.costPrice) + (q2 * p2.costPrice);
    const method = methods[i % methods.length];

    // Distribute timestamps over last 3 days
    const saleDate = new Date();
    saleDate.setHours(saleDate.getHours() - (i * 4));

    await prisma.sale.create({
      data: {
        orgId: org.id,
        billNumber: saleNum,
        customerName: i % 2 === 0 ? 'Walk-in Customer' : 'Suhail Ahmed',
        customerPhone: i % 2 === 0 ? undefined : '+91 97410 77889',
        subtotal,
        taxTotal,
        discountTotal: 0,
        total,
        costTotal,
        paymentMethod: method,
        cashReceived: method === 'CASH' ? Math.ceil(total / 10000) * 10000 : total,
        changeReturned: method === 'CASH' ? (Math.ceil(total / 10000) * 10000) - total : 0,
        createdAt: saleDate,
        updatedAt: saleDate,
        items: {
          create: [
            {
              productId: p1.id,
              productName: p1.name,
              barcode: p1.barcode,
              unit: p1.unit,
              quantity: q1,
              unitPrice: p1.price,
              costPrice: p1.costPrice,
              taxRate: p1.taxRate,
              taxAmount: Math.round((line1Total * p1.taxRate) / 10000),
              lineTotal: line1Total,
            },
            {
              productId: p2.id,
              productName: p2.name,
              barcode: p2.barcode,
              unit: p2.unit,
              quantity: q2,
              unitPrice: p2.price,
              costPrice: p2.costPrice,
              taxRate: p2.taxRate,
              taxAmount: Math.round((line2Total * p2.taxRate) / 10000),
              lineTotal: line2Total,
            },
          ],
        },
      },
    });
  }

  console.log('✅ Retail shop seed complete!');
  console.log('   Shop: Ameen Supermarket & Department Store');
  console.log('   Products seeded: ' + productsData.length);
  console.log('   Categories seeded: ' + categoriesData.length);
  console.log('   Sales seeded: 15 transactions');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
