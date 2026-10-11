const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/smart-shopping-mall';

async function resetAndSeed() {
  console.log('🔄 Connecting to MongoDB:', DATABASE_URL);
  await mongoose.connect(DATABASE_URL);
  console.log('✅ Connected to MongoDB successfully.');

  const db = mongoose.connection.db;

  // 1. CLEAR COLLECTIONS
  console.log('\n🧹 Clearing old products, orders, issues, wishlists, and notifications...');
  const deletedProducts = await db.collection('products').deleteMany({});
  const deletedOrders = await db.collection('orders').deleteMany({});
  const deletedIssues = (await db.listCollections({ name: 'issues' }).toArray()).length > 0
    ? await db.collection('issues').deleteMany({})
    : { deletedCount: 0 };
  const deletedWishlists = (await db.listCollections({ name: 'wishlists' }).toArray()).length > 0
    ? await db.collection('wishlists').deleteMany({})
    : { deletedCount: 0 };
  const deletedNotifs = (await db.listCollections({ name: 'notifications' }).toArray()).length > 0
    ? await db.collection('notifications').deleteMany({})
    : { deletedCount: 0 };

  console.log(`   - Deleted ${deletedProducts.deletedCount} products`);
  console.log(`   - Deleted ${deletedOrders.deletedCount} orders`);
  console.log(`   - Deleted ${deletedIssues.deletedCount} issues`);
  console.log(`   - Deleted ${deletedWishlists.deletedCount} wishlist entries`);
  console.log(`   - Deleted ${deletedNotifs.deletedCount} notifications`);

  // 2. SETUP USERS
  console.log('\n👥 Ensuring required users exist with consistent credentials...');
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!@', 10);

  const usersList = [
    {
      email: 'admin@example.com',
      name: 'Administrator',
      role: 'SUPER_ADMIN',
      password: adminPasswordHash,
      verified: true,
      country: 'UAE',
      location: 'Dubai, UAE',
      phone: '+971 4 000 0000',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    },
    {
      email: 'costas.kazikkis@gmail.com',
      name: 'Costas Kazikkis',
      role: 'USER',
      password: passwordHash,
      verified: true,
      country: 'UAE',
      location: 'One Park Avenue, Sobha Hartland, Dubai',
      phone: '+971 50 123 4567',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    },
    {
      email: 'mdbayazid131.dev@gmail.com',
      name: 'Pronoy pla',
      role: 'USER',
      password: passwordHash,
      verified: true,
      country: 'UAE',
      location: 'Downtown Dubai, UAE',
      phone: '+971 52 987 6543',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    },
    {
      email: 'seller.fatima@example.com',
      name: 'Fatima Al-Zahra',
      role: 'USER',
      password: passwordHash,
      verified: true,
      country: 'UAE',
      location: 'Palm Jumeirah, Dubai',
      phone: '+971 55 111 2233',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    },
    {
      email: 'seller.alex@example.com',
      name: 'Alexander Wright',
      role: 'USER',
      password: passwordHash,
      verified: true,
      country: 'UAE',
      location: 'Dubai Marina, UAE',
      phone: '+971 54 444 5566',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    },
  ];

  const userMap = {};
  for (const u of usersList) {
    let existing = await db.collection('users').findOne({ email: u.email });
    if (!existing) {
      const res = await db.collection('users').insertOne({
        ...u,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      existing = { _id: res.insertedId, ...u };
      console.log(`   + Created user: ${u.name} (${u.email})`);
    } else {
      await db.collection('users').updateOne(
        { _id: existing._id },
        {
          $set: {
            name: u.name,
            verified: true,
            location: u.location,
            phone: u.phone,
            avatar: u.avatar,
            role: u.role,
          },
        }
      );
      console.log(`   ✓ Updated user: ${u.name} (${u.email})`);
    }
    userMap[u.email] = existing;
  }

  const adminUser = userMap['admin@example.com'];
  const costas = userMap['costas.kazikkis@gmail.com'];
  const pronoy = userMap['mdbayazid131.dev@gmail.com'];
  const fatima = userMap['seller.fatima@example.com'];
  const alex = userMap['seller.alex@example.com'];

  // 3. SEED PRODUCTS
  console.log('\n👜 Seeding luxury products across all statuses...');

  let nextOrderId = 1001;
  const now = new Date();

  const productsDef = [
    // ── LIVE PRODUCTS (Available on Home Screen & Catalog) ──
    {
      orderId: nextOrderId++,
      name: 'Chanel Classic Double Flap Bag (Medium)',
      brand: 'Chanel',
      description: 'Iconic Chanel Medium Classic Flap bag in black quilted caviar leather with gold-tone hardware. Double flap closure, burgundy interior with CC stitch, and adjustable chain strap.',
      material: 'Caviar Leather',
      price: 34500,
      condition: 'Like New',
      originalPackagingAvailable: true,
      packaging: 'Original box, dust bag and authenticity card',
      images: [
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 38,
      seller: fatima._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Rolex Submariner Date 41mm (Ref. 126610LN)',
      brand: 'Rolex',
      description: 'Rolex Submariner Date in Oystersteel with black Cerachrom ceramic bezel and black dial. Calibre 3235 automatic movement with 70-hour power reserve. Complete set with box and papers.',
      material: 'Oystersteel',
      price: 52000,
      condition: 'Brand New',
      originalPackagingAvailable: true,
      packaging: 'Original Rolex green box, warranty card and hang tags',
      images: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 45,
      seller: alex._id,
      collectionAddress: alex.location,
      sellerPhone: alex.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Hermès Birkin 30 Gold Togo (Gold Hardware)',
      brand: 'Hermès',
      description: 'Hermès Birkin 30 crafted in supple Gold Togo leather accented with polished gold-plated hardware. Features tonal stitching, front flap closure, dual rolled handles, lock, keys, and clochette.',
      material: 'Togo Calfskin',
      price: 89000,
      condition: 'Pristine',
      originalPackagingAvailable: true,
      packaging: 'Orange box, ribbon, raincoat, and dustbag',
      images: [
        'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 72,
      seller: costas._id,
      collectionAddress: costas.location,
      sellerPhone: costas.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Louis Vuitton Neverfull MM Damier Ebene',
      brand: 'Louis Vuitton',
      description: 'Timeless Louis Vuitton Neverfull MM tote in Damier Ebene coated canvas with cerise red textile lining and smooth cowhide trim. Includes removable zippered clutch pouch.',
      material: 'Coated Canvas & Cowhide',
      price: 7500,
      condition: 'Like New',
      originalPackagingAvailable: true,
      packaging: 'Original dust bag and LV store receipt',
      images: [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 23,
      seller: pronoy._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Cartier Love Bracelet Small (18K Yellow Gold)',
      brand: 'Cartier',
      description: 'Cartier Love bracelet in 18K yellow gold, size 17. Iconic screw motif with functional screwdriver. Hallmarks and serial numbers crisp and authenticated.',
      material: '18K Yellow Gold',
      price: 27500,
      condition: 'Excellent',
      originalPackagingAvailable: true,
      packaging: 'Red Cartier jewelry box and certificate of authenticity',
      images: [
        'https://images.unsplash.com/photo-1611591475163-afb1b0b75497?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 29,
      seller: fatima._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Christian Dior Medium Lady Dior Cannage',
      brand: 'Christian Dior',
      description: 'Medium Lady Dior handbag in soft black lambskin with signature Cannage topstitching and pale gold-finish metal D.I.O.R. charms. Wide shoulder strap included.',
      material: 'Lambskin Leather',
      price: 21500,
      condition: 'Excellent',
      originalPackagingAvailable: true,
      packaging: 'Dust bag, authenticity card, and Dior box',
      images: [
        'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'live',
      wishlistCount: 34,
      seller: alex._id,
      collectionAddress: alex.location,
      sellerPhone: alex.phone,
    },

    // ── PENDING REVIEW PRODUCTS (Dashboard Pending Review & Seller Wardrobe) ──
    {
      orderId: nextOrderId++,
      name: 'Prada Re-Edition 2005 Re-Nylon Shoulder Bag',
      brand: 'Prada',
      description: 'Prada Re-Edition 2005 shoulder bag in desert beige recycled nylon with Saffiano leather trim and enamel triangle logo. Includes detachable pouch and chain handle.',
      material: 'Re-Nylon / Saffiano Leather',
      price: 6800,
      condition: 'Like New',
      originalPackagingAvailable: true,
      packaging: 'Dust bag, authenticity card, and store receipt',
      images: [
        'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'pending_review',
      wishlistCount: 0,
      seller: costas._id,
      collectionAddress: costas.location,
      sellerPhone: costas.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Bottega Veneta Padded Cassette Crossbody',
      brand: 'Bottega Veneta',
      description: 'Maxi intreccio weave leather crossbody bag in black padded nappa leather with silver-finish hardware. Adjustable shoulder strap with signature triangular buckle.',
      material: 'Padded Nappa Leather',
      price: 11500,
      condition: 'Brand New',
      originalPackagingAvailable: true,
      packaging: 'Original green dust bag and cards',
      images: [
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'pending_review',
      wishlistCount: 0,
      seller: pronoy._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Audemars Piguet Royal Oak 41mm Stainless Steel',
      brand: 'Audemars Piguet',
      description: 'Audemars Piguet Royal Oak Selfwinding with Grande Tapisserie blue dial. Stainless steel case with glareproofed sapphire crystal and caseback.',
      material: 'Stainless Steel',
      price: 145000,
      condition: 'Like New',
      originalPackagingAvailable: true,
      packaging: 'Green lacquered wooden box and extract from archives',
      images: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'pending_review',
      wishlistCount: 0,
      seller: fatima._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },

    // ── REJECTED PRODUCTS (Seller Wardrobe Testing) ──
    {
      orderId: nextOrderId++,
      name: 'Gucci GG Marmont Matelassé Shoulder Bag',
      brand: 'Gucci',
      description: 'Small GG Marmont shoulder bag in dusty pink chevron matelassé leather with Antique gold-toned Double G hardware.',
      material: 'Matelassé Leather',
      price: 8500,
      condition: 'Good',
      originalPackagingAvailable: false,
      images: [
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'rejected',
      rejectionReason: 'Photos do not clearly display the inner serial stamp and hardware hallmark. Please upload clearer high-resolution photos.',
      wishlistCount: 0,
      seller: costas._id,
      collectionAddress: costas.location,
      sellerPhone: costas.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Saint Laurent Kate Medium Tassel Shoulder Bag',
      brand: 'Saint Laurent',
      description: 'Saint Laurent Kate bag in smooth black calfskin leather featuring hanging metal tassel and polished gold YSL monogram.',
      material: 'Calfskin Leather',
      price: 9200,
      condition: 'Fair',
      originalPackagingAvailable: false,
      images: [
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'rejected',
      rejectionReason: 'Severe undisclosed scuff marks visible on corner trim that do not match listing condition.',
      wishlistCount: 0,
      seller: pronoy._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },

    // ── ORDER-CONNECTED PRODUCTS (Reserved, Collected, Authenticated, Dispatched, Delivered, Cancelled) ──
    {
      orderId: nextOrderId++,
      name: 'Fendi Baguette Medium Leather Bag',
      brand: 'Fendi',
      description: 'Iconic medium Baguette in soft black nappa leather with embossed FF motif and magnetic FF clasp. Detachable handle and shoulder strap.',
      material: 'Nappa Leather',
      price: 11200,
      condition: 'Brand New',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'reserved',
      wishlistCount: 8,
      seller: fatima._id,
      buyer: costas._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Cartier Santos de Cartier Large (Ref. WSSA0018)',
      brand: 'Cartier',
      description: 'Santos de Cartier watch in steel with silver opaline dial, blued-steel sword-shaped hands, and interchangeable SmartLink steel bracelet.',
      material: 'Stainless Steel',
      price: 29000,
      condition: 'Pristine',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'reserved',
      wishlistCount: 15,
      seller: alex._id,
      buyer: pronoy._id,
      collectionAddress: alex.location,
      sellerPhone: alex.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Chanel Boy Bag Medium Quilted Lambskin',
      brand: 'Chanel',
      description: 'Medium Boy Bag in black diamond quilted lambskin leather with ruthenium hardware. Push-lock clasp and adjustable gourmette chain strap.',
      material: 'Lambskin Leather',
      price: 26000,
      condition: 'Excellent',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'collected',
      wishlistCount: 12,
      seller: costas._id,
      buyer: alex._id,
      collectionAddress: costas.location,
      sellerPhone: costas.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Van Cleef & Arpels Vintage Alhambra 5 Motifs',
      brand: 'Van Cleef & Arpels',
      description: 'Vintage Alhambra bracelet featuring 5 clover motifs in Guilloché 18K yellow gold. Hallmarked with French assay stamps.',
      material: '18K Yellow Gold',
      price: 24500,
      condition: 'Like New',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1611591475163-afb1b0b75497?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'collected',
      wishlistCount: 20,
      seller: fatima._id,
      buyer: pronoy._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Patek Philippe Aquanaut 5167A-001 Black Dial',
      brand: 'Patek Philippe',
      description: 'Patek Philippe Aquanaut in stainless steel with black embossed dial and composite tropical strap. Calibre 324 S C self-winding movement.',
      material: 'Stainless Steel',
      price: 185000,
      condition: 'Pristine',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'authenticated',
      wishlistCount: 41,
      seller: alex._id,
      buyer: costas._id,
      collectionAddress: alex.location,
      sellerPhone: alex.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Goyard Saint Louis GM Tote (Black & Tan)',
      brand: 'Goyard',
      description: 'Saint Louis GM tote bag in classic Goyardine canvas with black and tan leather trim and detachable interior pochette.',
      material: 'Goyardine Canvas & Leather',
      price: 8800,
      condition: 'Brand New',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'authenticated',
      wishlistCount: 17,
      seller: pronoy._id,
      buyer: fatima._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Hermès Kelly 28 Sellier Epsom (Gold Hardware)',
      brand: 'Hermès',
      description: 'Kelly 28 in structured Epsom leather in Noir with shiny gold-plated hardware. Includes removable shoulder strap, padlock, keys, and clochette.',
      material: 'Epsom Calfskin',
      price: 76000,
      condition: 'Pristine',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'dispatched',
      wishlistCount: 33,
      seller: fatima._id,
      buyer: costas._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Bvlgari Serpenti Tubogas Watch Single Spiral',
      brand: 'Bvlgari',
      description: 'Serpenti Tubogas watch with 35 mm curved stainless steel case, 18K rose gold bezel set with diamonds, and silver opaline guilloché dial.',
      material: 'Stainless Steel & Rose Gold',
      price: 36000,
      condition: 'Like New',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1611591475163-afb1b0b75497?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'dispatched',
      wishlistCount: 22,
      seller: costas._id,
      buyer: pronoy._id,
      collectionAddress: costas.location,
      sellerPhone: costas.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Celine Triomphe Shoulder Bag in Shiny Calfskin',
      brand: 'Celine',
      description: 'Classique Triomphe bag in black shiny calfskin leather featuring iconic gold-finish metallic Triomphe closure and lambskin lining.',
      material: 'Shiny Calfskin',
      price: 13500,
      condition: 'Like New',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'sold',
      wishlistCount: 19,
      seller: pronoy._id,
      buyer: costas._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Tiffany & Co. HardWear Graduated Link Necklace',
      brand: 'Tiffany & Co.',
      description: 'Tiffany HardWear graduated link necklace in 18K yellow gold, 18 inches long. Bold industrial elegance designed for comfortable all-day wear.',
      material: '18K Yellow Gold',
      price: 64000,
      condition: 'Excellent',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1611591475163-afb1b0b75497?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'sold',
      wishlistCount: 27,
      seller: alex._id,
      buyer: pronoy._id,
      collectionAddress: alex.location,
      sellerPhone: alex.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Balenciaga Hourglass Small Handbag (Crocodile Embossed)',
      brand: 'Balenciaga',
      description: 'Hourglass small top handle bag in shiny black crocodile-embossed calfskin with aged-silver B logo hardware.',
      material: 'Embossed Calfskin',
      price: 8900,
      condition: 'Fair',
      originalPackagingAvailable: false,
      images: [
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'sold', // cancelled/refunded order item
      wishlistCount: 6,
      seller: fatima._id,
      buyer: costas._id,
      collectionAddress: fatima.location,
      sellerPhone: fatima.phone,
    },
    {
      orderId: nextOrderId++,
      name: 'Jacquemus Le Chiquito Moyen Handbag',
      brand: 'Jacquemus',
      description: 'Le Chiquito Moyen in smooth tan leather with magnetic flap, reinforced top handle, and golden logo plaque.',
      material: 'Smooth Leather',
      price: 3200,
      condition: 'Good',
      originalPackagingAvailable: true,
      images: [
        'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'sold', // cancelled/refunded order item
      wishlistCount: 9,
      seller: pronoy._id,
      buyer: alex._id,
      collectionAddress: pronoy.location,
      sellerPhone: pronoy.phone,
    },
  ];

  const createdProducts = [];
  for (const p of productsDef) {
    const commission = Math.round(p.price * 0.12);
    const earnings = p.price - commission;
    const doc = {
      ...p,
      commissionAmount: commission,
      sellerEarnings: earnings,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)),
      updatedAt: new Date(),
    };
    const res = await db.collection('products').insertOne(doc);
    createdProducts.push({ _id: res.insertedId, ...doc });
    console.log(`   + [${p.status.toUpperCase()}] #${p.orderId}: ${p.name} (${p.price} AED)`);
  }

  // Helper map by orderId
  const pMap = {};
  createdProducts.forEach(p => { pMap[p.orderId] = p; });

  // 4. SEED ORDERS
  console.log('\n📦 Seeding orders across all progress stages...');

  const ordersDef = [
    // ── STAGE 0: RESERVED / AWAITING COLLECTION (2 orders) ──
    {
      orderNumber: 'ORD-2026-101',
      product: pMap[1012]._id,
      buyer: costas._id,
      seller: fatima._id,
      price: pMap[1012].price,
      status: 'reserved',
      statusHistory: [
        { status: 'reserved', note: 'Order placed and payment secured via Stripe', changedAt: new Date(Date.now() - 3600000 * 4) }
      ],
      pickupWindow: {
        start: new Date(Date.now() + 3600000 * 2),
        end: new Date(Date.now() + 3600000 * 6),
      },
      deliveryDetails: {
        name: costas.name,
        address: costas.location,
        location: costas.location,
        phone: costas.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-102',
      product: pMap[1013]._id,
      buyer: pronoy._id,
      seller: alex._id,
      price: pMap[1013].price,
      status: 'collection_pending',
      statusHistory: [
        { status: 'reserved', note: 'Payment processed and verified', changedAt: new Date(Date.now() - 3600000 * 8) },
        { status: 'collection_pending', note: 'Courier dispatched to collect from seller', changedAt: new Date(Date.now() - 3600000 * 2) }
      ],
      pickupWindow: {
        start: new Date(Date.now() + 3600000 * 4),
        end: new Date(Date.now() + 3600000 * 8),
      },
      deliveryDetails: {
        name: pronoy.name,
        address: pronoy.location,
        location: pronoy.location,
        phone: pronoy.phone,
        country: 'UAE',
      },
    },

    // ── STAGE 1: COLLECTED (2 orders) ──
    {
      orderNumber: 'ORD-2026-103',
      product: pMap[1014]._id,
      buyer: alex._id,
      seller: costas._id,
      price: pMap[1014].price,
      status: 'collected',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 24) },
        { status: 'collected', note: 'Item collected from seller by Closeté Logistics', changedAt: new Date(Date.now() - 3600000 * 6) }
      ],
      deliveryDetails: {
        name: alex.name,
        address: alex.location,
        location: alex.location,
        phone: alex.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-104',
      product: pMap[1015]._id,
      buyer: pronoy._id,
      seller: fatima._id,
      price: pMap[1015].price,
      status: 'collected',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 28) },
        { status: 'collected', note: 'Item collected from seller and in transit to hub', changedAt: new Date(Date.now() - 3600000 * 10) }
      ],
      deliveryDetails: {
        name: pronoy.name,
        address: pronoy.location,
        location: pronoy.location,
        phone: pronoy.phone,
        country: 'UAE',
      },
    },

    // ── STAGE 2: VERIFICATION / AUTHENTICATED (2 orders) ──
    {
      orderNumber: 'ORD-2026-105',
      product: pMap[1016]._id,
      buyer: costas._id,
      seller: alex._id,
      price: pMap[1016].price,
      status: 'verification',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 48) },
        { status: 'collected', note: 'Item collected from seller', changedAt: new Date(Date.now() - 3600000 * 30) },
        { status: 'verification', note: 'Arrived at Closeté Verification Hub - undergoing 50-point inspection', changedAt: new Date(Date.now() - 3600000 * 12) }
      ],
      deliveryDetails: {
        name: costas.name,
        address: costas.location,
        location: costas.location,
        phone: costas.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-106',
      product: pMap[1017]._id,
      buyer: fatima._id,
      seller: pronoy._id,
      price: pMap[1017].price,
      status: 'verification',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 50) },
        { status: 'collected', note: 'Item collected from seller', changedAt: new Date(Date.now() - 3600000 * 32) },
        { status: 'verification', note: 'Under authentication review at Dubai HQ', changedAt: new Date(Date.now() - 3600000 * 14) }
      ],
      deliveryDetails: {
        name: fatima.name,
        address: fatima.location,
        location: fatima.location,
        phone: fatima.phone,
        country: 'UAE',
      },
    },

    // ── STAGE 3: DISPATCHED / READY FOR DELIVERY (2 orders) ──
    {
      orderNumber: 'ORD-2026-107',
      product: pMap[1018]._id,
      buyer: costas._id,
      seller: fatima._id,
      price: pMap[1018].price,
      status: 'dispatched',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 72) },
        { status: 'collected', note: 'Item collected', changedAt: new Date(Date.now() - 3600000 * 54) },
        { status: 'verification', note: 'Passed 100% authentication test', changedAt: new Date(Date.now() - 3600000 * 36) },
        { status: 'dispatched', note: 'Dispatched via premium courier with GPS tracking', changedAt: new Date(Date.now() - 3600000 * 8) }
      ],
      estimatedDeliveryAt: new Date(Date.now() + 3600000 * 12),
      deliveryDetails: {
        name: costas.name,
        address: costas.location,
        location: costas.location,
        phone: costas.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-108',
      product: pMap[1019]._id,
      buyer: pronoy._id,
      seller: costas._id,
      price: pMap[1019].price,
      status: 'ready_for_delivery',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 3600000 * 80) },
        { status: 'collected', note: 'Item collected from seller', changedAt: new Date(Date.now() - 3600000 * 60) },
        { status: 'verification', note: 'Passed expert jewelry authentication', changedAt: new Date(Date.now() - 3600000 * 40) },
        { status: 'ready_for_delivery', note: 'Out for delivery today to buyer', changedAt: new Date(Date.now() - 3600000 * 4) }
      ],
      estimatedDeliveryAt: new Date(Date.now() + 3600000 * 6),
      deliveryDetails: {
        name: pronoy.name,
        address: pronoy.location,
        location: pronoy.location,
        phone: pronoy.phone,
        country: 'UAE',
      },
    },

    // ── STAGE 4: DELIVERED / COMPLETED (2 orders) ──
    {
      orderNumber: 'ORD-2026-109',
      product: pMap[1020]._id,
      buyer: costas._id,
      seller: pronoy._id,
      price: pMap[1020].price,
      status: 'delivered',
      payoutStatus: 'paid',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 86400000 * 5) },
        { status: 'collected', note: 'Item collected from seller', changedAt: new Date(Date.now() - 86400000 * 4) },
        { status: 'verification', note: 'Authenticated', changedAt: new Date(Date.now() - 86400000 * 3) },
        { status: 'dispatched', note: 'Dispatched to buyer', changedAt: new Date(Date.now() - 86400000 * 2) },
        { status: 'delivered', note: 'Delivered and signed by buyer. Seller payout processed.', changedAt: new Date(Date.now() - 3600000 * 18) }
      ],
      deliveryDetails: {
        name: costas.name,
        address: costas.location,
        location: costas.location,
        phone: costas.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-110',
      product: pMap[1021]._id,
      buyer: pronoy._id,
      seller: alex._id,
      price: pMap[1021].price,
      status: 'completed',
      payoutStatus: 'paid',
      statusHistory: [
        { status: 'reserved', note: 'Order created', changedAt: new Date(Date.now() - 86400000 * 7) },
        { status: 'collected', note: 'Item collected', changedAt: new Date(Date.now() - 86400000 * 6) },
        { status: 'verification', note: 'Authenticated', changedAt: new Date(Date.now() - 86400000 * 4) },
        { status: 'dispatched', note: 'Dispatched to buyer', changedAt: new Date(Date.now() - 86400000 * 2) },
        { status: 'completed', note: 'Successfully delivered and completed.', changedAt: new Date(Date.now() - 86400000 * 1) }
      ],
      deliveryDetails: {
        name: pronoy.name,
        address: pronoy.location,
        location: pronoy.location,
        phone: pronoy.phone,
        country: 'UAE',
      },
    },

    // ── STAGE 5: ISSUES / CANCELLED / REFUNDED (2 orders) ──
    {
      orderNumber: 'ORD-2026-111',
      product: pMap[1022]._id,
      buyer: costas._id,
      seller: fatima._id,
      price: pMap[1022].price,
      status: 'refunded',
      outcome: 'authentication_failed',
      refundAmount: pMap[1022].price,
      handlingFeeCharged: 250,
      payoutStatus: 'reversed',
      statusHistory: [
        { status: 'reserved', note: 'Order placed', changedAt: new Date(Date.now() - 86400000 * 3) },
        { status: 'collected', note: 'Collected from seller', changedAt: new Date(Date.now() - 86400000 * 2) },
        { status: 'verification', note: 'Failed authentication check', changedAt: new Date(Date.now() - 86400000 * 1) },
        { status: 'refunded', note: 'Order cancelled due to authentication failure. Full refund issued to buyer.', changedAt: new Date(Date.now() - 3600000 * 12) }
      ],
      deliveryDetails: {
        name: costas.name,
        address: costas.location,
        location: costas.location,
        phone: costas.phone,
        country: 'UAE',
      },
    },
    {
      orderNumber: 'ORD-2026-112',
      product: pMap[1023]._id,
      buyer: alex._id,
      seller: pronoy._id,
      price: pMap[1023].price,
      status: 'cancelled',
      outcome: 'seller_unavailable',
      refundAmount: pMap[1023].price,
      payoutStatus: 'failed',
      statusHistory: [
        { status: 'reserved', note: 'Order placed', changedAt: new Date(Date.now() - 86400000 * 4) },
        { status: 'cancelled', note: 'Seller unavailable for pickup after 3 attempts. Order cancelled.', changedAt: new Date(Date.now() - 86400000 * 2) }
      ],
      deliveryDetails: {
        name: alex.name,
        address: alex.location,
        location: alex.location,
        phone: alex.phone,
        country: 'UAE',
      },
    },
  ];

  const createdOrders = [];
  for (const o of ordersDef) {
    const fee = Math.round(o.price * 0.12);
    const payout = o.price - fee;
    const doc = {
      ...o,
      platformFee: fee,
      sellerPayout: payout,
      payment: {
        provider: 'stripe',
        paymentIntentId: `pi_seed_${o.orderNumber.replace(/-/g, '_').toLowerCase()}`,
        status: o.status === 'refunded' ? 'refunded' : 'paid',
      },
      payoutStatus: o.payoutStatus || (o.status === 'delivered' || o.status === 'completed' ? 'paid' : 'pending'),
      missedCollectionAttempts: o.status === 'cancelled' ? 3 : 0,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 5)),
      updatedAt: new Date(),
    };
    const res = await db.collection('orders').insertOne(doc);
    createdOrders.push({ _id: res.insertedId, ...doc });
    console.log(`   + [${o.status.toUpperCase()}] ${o.orderNumber}: ${pMap[o.product]?.name || 'Item'} (${o.price} AED)`);
  }

  // 5. SEED ISSUES (For Admin Dashboard Issues tab)
  console.log('\n⚠️ Seeding reported issues for Admin Dashboard Issues tab...');
  const issuesDef = [
    {
      product: pMap[1022]._id,
      orderId: pMap[1022].orderId,
      buyer: costas._id,
      seller: fatima._id,
      issueType: 'verification_failed',
      outcome: 'authentication_failed',
      reason: 'Physical authentication failed: Stitching density and hardware engraving did not match genuine specifications.',
      admin: adminUser._id,
      resolved: false, // Active unresolved issue!
      createdAt: new Date(Date.now() - 3600000 * 12),
      updatedAt: new Date(),
    },
    {
      product: pMap[1023]._id,
      orderId: pMap[1023].orderId,
      buyer: alex._id,
      seller: pronoy._id,
      issueType: 'seller_unavailable',
      outcome: 'seller_unavailable',
      reason: 'Seller was not reachable via phone or at collection address for 3 scheduled pickup attempts.',
      admin: adminUser._id,
      resolved: true, // Resolved issue!
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(),
    },
  ];

  for (const iss of issuesDef) {
    await db.collection('issues').insertOne(iss);
    console.log(`   + [ISSUE - ${iss.resolved ? 'RESOLVED' : 'UNRESOLVED'}] ${iss.issueType}: ${iss.reason.substring(0, 50)}...`);
  }

  console.log('\n======================================================');
  console.log('🎉 DATABASE RESET & RE-SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`Summary:`);
  console.log(`  - Products seeded: ${createdProducts.length}`);
  console.log(`    • live: 6`);
  console.log(`    • pending_review: 3`);
  console.log(`    • rejected: 2`);
  console.log(`    • reserved: 2`);
  console.log(`    • collected: 2`);
  console.log(`    • authenticated: 2`);
  console.log(`    • dispatched: 2`);
  console.log(`    • sold: 4`);
  console.log(`  - Orders seeded: ${createdOrders.length}`);
  console.log(`    • reserved (Awaiting Collection): 2`);
  console.log(`    • collected (Collected): 2`);
  console.log(`    • verification (Verified): 2`);
  console.log(`    • dispatched (Dispatched): 2`);
  console.log(`    • delivered / completed (Delivered): 2`);
  console.log(`    • refunded / cancelled (Issues): 2`);
  console.log(`  - Issues seeded: ${issuesDef.length} (1 unresolved, 1 resolved)`);
  console.log(`\nTest User Credentials:`);
  console.log(`  - Admin: admin@example.com / AdminPassword123!@`);
  console.log(`  - Costas: costas.kazikkis@gmail.com / Password123!`);
  console.log(`  - Pronoy: mdbayazid131.dev@gmail.com / Password123!`);
  console.log(`  - Fatima: seller.fatima@example.com / Password123!`);
  console.log(`  - Alex: seller.alex@example.com / Password123!`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
  process.exit(0);
}

resetAndSeed().catch((err) => {
  console.error('❌ Error during reset and seed:', err);
  process.exit(1);
});
