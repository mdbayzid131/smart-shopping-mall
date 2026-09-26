/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Format seller information for public consumption
 */
export const formatSeller = (seller: any) => {
  if (!seller || typeof seller !== 'object') return null;

  const { _id, name, avatar, image, contact } = seller;
  let { location, country } = seller;

  if (!country && typeof location === 'string' && location.includes(',')) {
    const parts = location.split(',').map((p: string) => p.trim());
    country = parts.pop() || null;
    location = parts.join(', ');
  }

  return {
    _id: _id?.toString(),
    name: name || '',
    profileImage: avatar || image || null,
    contact: contact || null,
    location: location || null,
    country: country || null,
  };
};

/**
 * Format buyer information for public/seller consumption
 */
export const formatBuyer = (buyer: any) => {
  if (!buyer || typeof buyer !== 'object') return null;

  const { _id, name, avatar, image, contact } = buyer;
  const { location, country, phone, address } = buyer;

  return {
    _id: _id?.toString(),
    name: name || '',
    profileImage: avatar || image || null,
    contact: contact || phone || null,
    phone: contact || phone || null,
    location: location || null,
    country: country || null,
    address: address || null,
  };
};

/**
/**
 * Format active/past order information attached to product details
 */
export const formatOrder = (order: any) => {
  if (!order || typeof order !== 'object') return null;

  const id = order._id?.toString() || order.id?.toString();
  const status = order.status === 'secured' ? 'reserved' : order.status;

  return {
    _id: id,
    orderNumber: order.orderNumber,
    status,
    price: order.price,
    platformFee: order.platformFee,
    sellerPayout: order.sellerPayout,
    outcome: order.outcome || null,
    note: order.note || null,
    cancellationReason: order.cancellationReason || order.note || null,
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map((h: any) => ({
          status: h.status === 'secured' ? 'reserved' : h.status,
          note: h.note || null,
          changedAt: h.changedAt,
        }))
      : [],
    deliveryDetails: order.deliveryDetails,
    createdAt: order.createdAt,
  };
};

/**
 * Clean product detail transformer for single product view (GET /products/:id)
 */
export const toPublicProduct = (product: any, order?: any) => {
  if (!product) return product;
  const value = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };

  const id = value._id ? value._id.toString() : (value.id ? value.id.toString() : '');
  const images = (value.images && value.images.length > 0) ? value.images : (value.image ? [value.image] : []);

  const normalizeStatus = (statusStr?: string | null) => {
    if (!statusStr) return null;
    if (statusStr === 'secured') return 'reserved';
    return statusStr;
  };

  const rawOrder = order || value.order;
  const formattedOrder = formatOrder(rawOrder);
  if (formattedOrder && formattedOrder.status) {
    formattedOrder.status = normalizeStatus(formattedOrder.status);
  }

  const effectiveBuyer = formatBuyer(rawOrder?.buyer || value.buyer);
  let effectiveStatus = normalizeStatus(value.status) || value.status;

  if (formattedOrder?.status) {
    effectiveStatus = formattedOrder.status;
  }

  const finalOrderStatus = formattedOrder?.status || (['reserved', 'sold', 'paid', 'collected', 'authenticated', 'dispatched', 'delivered', 'cancelled', 'refunded'].includes(effectiveStatus) ? effectiveStatus : null);

  return {
    _id: id,
    name: value.name,
    brand: value.brand,
    description: value.description,
    price: value.price,
    condition: value.condition,
    material: value.material || '',
    packaging: value.packaging || '',
    originalPackagingAvailable: Boolean(value.originalPackagingAvailable),
    proofOfPurchase: value.proofOfPurchase || null,
    status: effectiveStatus,
    orderStatus: finalOrderStatus,
    rejectionReason: value.rejectionReason || null,
    commissionAmount: value.commissionAmount,
    sellerEarnings: value.sellerEarnings,
    collectionAddress: value.collectionAddress || '',
    sellerPhone: value.sellerPhone || '',
    wishlistCount: Math.max(0, Number(value.wishlistCount) || 0),
    images,
    seller: formatSeller(value.seller),
    buyer: effectiveBuyer,
    order: formattedOrder,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

/**
 * Product feed transformer for public feed / newsfeed (GET /products)
 */
export const toFeedProduct = (product: any) => {
  if (!product) return product;
  const value = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };

  const id = value._id ? value._id.toString() : (value.id ? value.id.toString() : '');
  const images = (value.images && value.images.length > 0) ? value.images : (value.image ? [value.image] : []);

  return {
    _id: id,
    name: value.name,
    brand: value.brand,
    description: value.description,
    price: value.price,
    condition: value.condition,
    originalPackagingAvailable: Boolean(value.originalPackagingAvailable),
    proofOfPurchase: value.proofOfPurchase || null,
    status: value.status === 'secured' ? 'reserved' : value.status,
    rejectionReason: value.rejectionReason || null,
    wishlistCount: Math.max(0, Number(value.wishlistCount) || 0),
    images,
    seller: formatSeller(value.seller),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

/**
 * Lightweight transformer for product list views (GET /products/my-products, GET /products?seller=...)
 */
export const toProductListItem = (product: any, orderStatus?: string) => {
  if (!product) return product;
  const value = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };

  const id = value._id ? value._id.toString() : (value.id ? value.id.toString() : '');
  const images = (value.images && value.images.length > 0) ? value.images : (value.image ? [value.image] : []);

  const normalizeStatus = (statusStr?: string | null) => {
    if (!statusStr) return null;
    if (statusStr === 'secured') return 'reserved';
    return statusStr;
  };

  let effectiveStatus = normalizeStatus(value.status) || value.status;
  const normalizedOrderStatus = normalizeStatus(orderStatus);

  if (normalizedOrderStatus) {
    if (['reserved', 'sold', 'in_transit', 'paid', 'collected', 'authenticated', 'dispatched', 'delivered'].includes(effectiveStatus)) {
      effectiveStatus = normalizedOrderStatus;
    }
  }

  const finalOrderStatus = normalizedOrderStatus || (['reserved', 'sold', 'paid', 'collected', 'authenticated', 'dispatched', 'delivered'].includes(effectiveStatus) ? effectiveStatus : null);

  return {
    _id: id,
    name: value.name,
    brand: value.brand,
    description: value.description,
    price: value.price,
    condition: value.condition,
    originalPackagingAvailable: Boolean(value.originalPackagingAvailable),
    proofOfPurchase: value.proofOfPurchase || null,
    status: effectiveStatus,
    orderStatus: finalOrderStatus,
    rejectionReason: value.rejectionReason || null,
    commissionAmount: value.commissionAmount,
    sellerEarnings: value.sellerEarnings,
    wishlistCount: Math.max(0, Number(value.wishlistCount) || 0),
    images,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

/**
 * Full product transformer for admin dashboard views
 */
export const toAdminProduct = (product: any) => {
  if (!product) return product;
  const value = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
  const id = value._id ? value._id.toString() : (value.id ? value.id.toString() : '');
  const images = (value.images && value.images.length > 0) ? value.images : (value.image ? [value.image] : []);

  return {
    _id: id,
    orderId: value.orderId,
    name: value.name,
    brand: value.brand,
    description: value.description,
    price: value.price,
    condition: value.condition,
    material: value.material || '',
    packaging: value.packaging || '',
    originalPackagingAvailable: Boolean(value.originalPackagingAvailable),
    proofOfPurchase: value.proofOfPurchase || null,
    status: value.status === 'secured' ? 'reserved' : value.status,
    rejectionReason: value.rejectionReason || null,
    reviewedBy: value.reviewedBy || null,
    reviewedAt: value.reviewedAt || null,
    commissionAmount: value.commissionAmount,
    sellerEarnings: value.sellerEarnings,
    collectionAddress: value.collectionAddress || '',
    sellerPhone: value.sellerPhone || '',
    wishlistCount: Math.max(0, Number(value.wishlistCount) || 0),
    images,
    seller: formatSeller(value.seller),
    buyer: formatBuyer(value.buyer),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};
