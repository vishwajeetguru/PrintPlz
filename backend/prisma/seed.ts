import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  // System settings
  await prisma.systemSetting.upsert({ where: { key: 'maintenance_mode' }, update: {}, create: { key: 'maintenance_mode', value: 'false' } });
  await prisma.systemSetting.upsert({
    where: { key: 'maintenance_message' },
    update: {},
    create: { key: 'maintenance_message', value: 'PrintPlz is under maintenance. Please try again shortly.' },
  });

  // Super admin
  const superAdmin = await prisma.user.upsert({
    where: { phone: env.SUPERADMIN_PHONE },
    update: { role: 'SUPER_ADMIN', isActive: true, name: env.SUPERADMIN_NAME, passwordHash: await hashPassword(env.SUPERADMIN_PASSWORD), mustSetPassword: false },
    create: { phone: env.SUPERADMIN_PHONE, role: 'SUPER_ADMIN', name: env.SUPERADMIN_NAME, passwordHash: await hashPassword(env.SUPERADMIN_PASSWORD), mustSetPassword: false },
  });
  console.log('Super admin:', superAdmin.phone);

  // Vendor: Rajesh Xerox Center (matches mobile mock)
  const vendorPhone = '+919876543210';
  const vendor = await prisma.user.upsert({
    where: { phone: vendorPhone },
    update: { role: 'VENDOR', name: 'Rajesh Kumar', passwordHash: await hashPassword('Shop@123'), mustSetPassword: false, isActive: true },
    create: { phone: vendorPhone, role: 'VENDOR', name: 'Rajesh Kumar', passwordHash: await hashPassword('Shop@123'), mustSetPassword: false },
  });

  const shop = await prisma.shop.upsert({
    where: { shopCode: 'PF-RJC-1024' },
    update: { name: 'Rajesh Xerox Center', ownerName: 'Rajesh Kumar', phone: vendorPhone, ownerUserId: vendor.id, isActive: true, isOnline: true, openTime: '09:00', closeTime: '21:00', workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat', qrUrl: 'https://printplz.app/shop/PF-RJC-1024' },
    create: {
      shopCode: 'PF-RJC-1024',
      name: 'Rajesh Xerox Center',
      ownerName: 'Rajesh Kumar',
      phone: vendorPhone,
      address: 'Shop 12, MG Road, Bengaluru',
      openTime: '09:00',
      closeTime: '21:00',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
      ownerUserId: vendor.id,
      qrUrl: 'https://printplz.app/shop/PF-RJC-1024',
      priceBw: 2,
      priceColor: 10,
    },
  });

  await prisma.printer.deleteMany({ where: { shopId: shop.id } });
  await prisma.printer.createMany({
    data: [
      { shopId: shop.id, name: 'HP LaserJet Pro', connectionType: 'WIFI', status: 'CONNECTED', isDefault: true, paperLevel: 72, tonerLevel: 'Good', tonerPercent: 82, ipAddress: '192.168.1.42', model: 'MFP M428fdw' },
      { shopId: shop.id, name: 'Canon G3020', connectionType: 'WIFI', status: 'OFFLINE', isDefault: false, paperLevel: 35, tonerLevel: 'Low', tonerPercent: 22, ipAddress: '192.168.1.43', model: 'PIXMA G3020' },
    ],
  });

  await prisma.printRequest.deleteMany({ where: { shopId: shop.id } });
  const now = Date.now();
  const reqs = [
    { id: 'PF1024', documentName: 'Aadhaar_Card.pdf', fileType: 'PDF', pages: 2, copies: 2, colorMode: 'BW', totalPages: 4, amount: 8, status: 'NEW', customerName: 'Aarav Sharma', hoursAgo: 1 },
    { id: 'PF1023', documentName: 'PAN_Card.pdf', fileType: 'PDF', pages: 1, copies: 2, colorMode: 'BW', totalPages: 2, amount: 4, status: 'PRINTING', customerName: 'Priya Nair', hoursAgo: 2 },
    { id: 'PF1022', documentName: 'Marksheet.pdf', fileType: 'PDF', pages: 4, copies: 1, colorMode: 'BW', totalPages: 4, amount: 8, status: 'NEW', customerName: 'Rohan Verma', hoursAgo: 3 },
    { id: 'PF1021', documentName: 'Passport.jpg', fileType: 'JPG', pages: 1, copies: 2, colorMode: 'COLOR', totalPages: 2, amount: 20, status: 'NEW', customerName: 'Sneha Iyer', hoursAgo: 4 },
    { id: 'PF1020', documentName: 'Offer_Letter.pdf', fileType: 'PDF', pages: 6, copies: 1, colorMode: 'BW', totalPages: 6, amount: 12, status: 'COMPLETED', customerName: 'Kiran Patel', hoursAgo: 6 },
    { id: 'PF1019', documentName: 'Voter_ID.pdf', fileType: 'PDF', pages: 2, copies: 1, colorMode: 'BW', totalPages: 2, amount: 4, status: 'COMPLETED', customerName: 'Meera Joshi', hoursAgo: 8 },
  ] as const;
  for (const r of reqs) {
    await prisma.printRequest.create({
      data: {
        id: r.id,
        shopId: shop.id,
        documentName: r.documentName,
        fileType: r.fileType as never,
        fileSizeBytes: 1024 * 1024,
        pages: r.pages,
        copies: r.copies,
        colorMode: r.colorMode as never,
        paperSize: 'A4',
        printSides: 'SINGLE',
        totalPages: r.totalPages,
        amount: r.amount,
        status: r.status as never,
        customerName: r.customerName,
        createdAt: new Date(now - r.hoursAgo * 3600 * 1000),
      },
    });
  }

  await prisma.notification.deleteMany({ where: { shopId: shop.id } });
  await prisma.notification.createMany({
    data: [
      { shopId: shop.id, type: 'NEW_REQUEST', title: 'New Print Request', message: 'New print request from a customer.' },
      { shopId: shop.id, type: 'PRINT_COMPLETED', title: 'Print Completed', message: 'Request #PF1024 has been printed.' },
      { shopId: shop.id, type: 'INFO', title: 'Printer Disconnected', message: 'HP LaserJet Pro is offline.' },
    ],
  });

  console.log('Seed done. Shop PF-RJC-1024 with 6 requests.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
