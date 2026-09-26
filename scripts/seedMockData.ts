import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import config from '../src/config';
import { User } from '../src/app/modules/user/user.model';
import { Product } from '../src/app/modules/product/product.model';
import { USER_ROLES } from '../src/enums/user';

const seedMockData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.database_url);
    console.log('✅ Connected to MongoDB successfully.');

    // 1. Create Mock Sellers
    const passwordHash = await bcrypt.hash(
      'Password123!',
      config.bcrypt_salt_rounds,
    );

    const sellersData = [
      {
        name: 'Fatima Al-Zahra',
        email: 'seller.fatima@example.com',
        password: passwordHash,
        role: USER_ROLES.USER,
        verified: true,
        country: 'UAE',
        location: 'Downtown Dubai',
        phone: '+971 50 123 4567',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      },
      {
        name: 'Alexander Wright',
        email: 'seller.alex@example.com',
        password: passwordHash,
        role: USER_ROLES.USER,
        verified: true,
        country: 'UAE',
        location: 'Palm Jumeirah, Dubai',
        phone: '+971 52 987 6543',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      },
    ];

    const createdSellers: any[] = [];
    for (const seller of sellersData) {
      let user = await User.findOne({ email: seller.email });
      if (!user) {
        user = await User.create(seller);
        console.log(`👤 Created Seller: ${seller.name} (${seller.email})`);
      } else {
        console.log(`ℹ️ Seller already exists: ${seller.name}`);
      }
      createdSellers.push(user);
    }

    const seller1Id = createdSellers[0]._id;
    const seller2Id = createdSellers[1]._id;

    // 2. Mock Luxury Products Data
    const mockProducts = [
      {
        orderId: 1001,
        name: 'Chanel Classic Double Flap Bag (Medium)',
        brand: 'Chanel',
        description:
          'Iconic Chanel Medium Classic Flap bag in black quilted caviar leather with gold-tone hardware. Double flap closure, burgundy leather interior with CC stitch, and adjustable chain shoulder strap. Pristine condition with original box and dustbag.',
        material: 'Caviar Leather',
        features: ['Gold-Tone Hardware', 'Double Flap', 'Burgundy Interior', 'Serial Sticker Intact'],
        price: 34500,
        condition: 'Like New',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 14,
        seller: seller1Id,
      },
      {
        orderId: 1002,
        name: 'Rolex Submariner Date 41mm (Ref. 126610LN)',
        brand: 'Rolex',
        description:
          'Rolex Submariner Date in Oystersteel with black Cerachrom ceramic bezel and black dial. Calibre 3235 automatic movement with 70-hour power reserve. Complete set with box, warranty card, and tags.',
        material: 'Oystersteel',
        features: ['Cerachrom Bezel', '70h Power Reserve', 'Unworn', 'Full Set 2025'],
        price: 52000,
        condition: 'Brand New',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 28,
        seller: seller2Id,
      },
      {
        orderId: 1003,
        name: 'Hermès Birkin 30 Gold Hardware',
        brand: 'Hermès',
        description:
          'Hermès Birkin 30 crafted in supple Gold Togo leather accented with polished gold-plated hardware. Features tonal stitching, front flap closure, and dual rolled handles. Kept in temperature-controlled storage.',
        material: 'Togo Calfskin',
        features: ['Gold Hardware', 'Lock & Keys', 'Raincoat & Clochette', 'Original Receipt Available'],
        price: 89000,
        condition: 'Excellent',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 42,
        seller: seller1Id,
      },
      {
        orderId: 1004,
        name: 'Louis Vuitton Neverfull MM Damier Ebene',
        brand: 'Louis Vuitton',
        description:
          'Timeless Louis Vuitton Neverfull MM tote in Damier Ebene canvas with cerise red textile lining and smooth cowhide leather trim. Includes removable zippered pouch.',
        material: 'Coated Canvas & Cowhide',
        features: ['Side Laces', 'Removable Pouch', 'Red Interior', 'Dust Bag Included'],
        price: 7200,
        condition: 'Like New',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 19,
        seller: seller2Id,
      },
      {
        orderId: 1005,
        name: 'Cartier Love Bracelet Small (18K Yellow Gold)',
        brand: 'Cartier',
        description:
          'Cartier Love bracelet in 18K yellow gold, size 17. Iconic screw motif design with functional screwdriver. Hallmarks and serial numbers crisp and clear. Polished and certified authentic.',
        material: '18K Yellow Gold',
        features: ['Size 17', 'Screwdriver Included', 'Certificate of Authenticity', 'Red Cartier Box'],
        price: 27000,
        condition: 'Excellent',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1611591475163-afb1b0b75497?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 31,
        seller: seller1Id,
      },
      {
        orderId: 1006,
        name: 'Christian Dior Medium Lady Dior Cannage',
        brand: 'Christian Dior',
        description:
          'Medium Lady Dior handbag in soft black lambskin with signature Cannage topstitching and pale gold-finish metal D.I.O.R. charms. Can be carried by hand or worn crossbody with the wide strap.',
        material: 'Lambskin Leather',
        features: ['Cannage Quilted', 'Pale Gold Charms', 'Detachable Shoulder Strap'],
        price: 21500,
        condition: 'Excellent',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 22,
        seller: seller2Id,
      },
      {
        orderId: 1007,
        name: 'Gucci GG Marmont Matelassé Shoulder Bag',
        brand: 'Gucci',
        description:
          'Small GG Marmont shoulder bag in dusty pink chevron matelassé leather with Antique gold-toned Double G hardware. Sliding chain strap can be doubled for shoulder wear or extended for crossbody.',
        material: 'Matelassé Leather',
        features: ['Double G Logo', 'Sliding Chain Strap', 'Microfiber Interior'],
        price: 8500,
        condition: 'Like New',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 16,
        seller: seller1Id,
      },
      {
        orderId: 1008,
        name: 'Saint Laurent LouLou Small Chain Bag',
        brand: 'Saint Laurent',
        description:
          'Saint Laurent LouLou small bag in black "Y" quilted calfskin with silver-tone YSL monogram. Two interior compartments with center zip pocket.',
        material: 'Calfskin Leather',
        features: ['YSL Monogram', 'Magnetic Snap Closure', 'Silver Hardware'],
        price: 9800,
        condition: 'Like New',
        originalPackagingAvailable: true,
        images: [
          'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'live',
        wishlistCount: 11,
        seller: seller2Id,
      },
      {
        orderId: 1009,
        name: 'Prada Re-Edition 2005 Re-Nylon Shoulder Bag',
        brand: 'Prada',
        description:
          'Prada Re-Edition 2005 shoulder bag in desert beige recycled nylon with Saffiano leather trim and enamel triangle logo. Includes removable pouch and chain strap.',
        material: 'Re-Nylon / Saffiano Leather',
        features: ['Detachable Pouch', 'Chain Handle', 'Enamel Logo'],
        price: 6200,
        commissionAmount: 744,
        sellerEarnings: 5456,
        condition: 'Like New',
        originalPackagingAvailable: true,
        packaging: 'Original box, dust bag and authenticity card',
        collectionAddress: 'Villa 14, Al Wasl Road, Jumeirah 1, Dubai',
        sellerPhone: '+971 50 123 4567',
        images: [
          'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'pending_review',
        wishlistCount: 0,
        seller: seller1Id,
      },
      {
        orderId: 1010,
        name: 'Bottega Veneta Cassette Crossbody Bag (Black)',
        brand: 'Bottega Veneta',
        description:
          'Maxi intreccio weave leather crossbody bag in black padded nappa leather with silver-finish hardware. Adjustable shoulder strap with signature triangular buckle.',
        material: 'Padded Nappa Leather',
        features: ['Maxi Intreccio Weave', 'Signature Buckle', 'Magnetic Closure'],
        price: 11500,
        commissionAmount: 1380,
        sellerEarnings: 10120,
        condition: 'Brand New',
        originalPackagingAvailable: true,
        packaging: 'Dust bag and store receipt',
        collectionAddress: 'Apartment 2204, Marina Crown Tower, Dubai Marina',
        sellerPhone: '+971 52 987 6543',
        images: [
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        ],
        status: 'pending_review',
        wishlistCount: 0,
        seller: seller2Id,
      },
    ];

    for (const prod of mockProducts) {
      const existing = await Product.findOne({ orderId: prod.orderId });
      if (!existing) {
        await Product.create(prod);
        console.log(`👜 Added Product [#${prod.orderId}]: ${prod.name} (${prod.price} AED)`);
      } else {
        console.log(`ℹ️ Product #${prod.orderId} already exists, skipping.`);
      }
    }

    console.log('\n🎉 All mock sellers and products seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    process.exit(1);
  }
};

seedMockData();
