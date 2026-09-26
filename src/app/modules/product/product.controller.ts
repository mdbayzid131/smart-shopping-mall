/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ProductService } from './product.service';

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const productData = req.body;
  const user = req.user as any;

  const result = await ProductService.createProductToDB(
    { ...productData, seller: user.id },
    req.files,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Product created successfully',
    data: result,
  });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as { id?: unknown } | undefined;
  const viewerId =
    typeof user?.id === 'string' ? user.id : undefined;
  const result = await ProductService.getAllProductsFromDB(
    req.query,
    viewerId,
  );

  res.vary('Authorization');
  res.setHeader(
    'Cache-Control',
    viewerId
      ? 'private, max-age=15, stale-while-revalidate=30'
      : 'public, max-age=15, stale-while-revalidate=30',
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Products retrieved successfully',
    pagination: result.meta,
    data: result.result,
  });
});

const getAllProductsForAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ProductService.getAllProductsForAdmin(req.query);

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Products retrieved successfully',
      pagination: result.meta,
      data: result.result,
    });
  },
);

const getProductDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductDetailsFromDB(req.params.id);

  res.setHeader(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300',
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await ProductService.updateProductToDB(
    req.params.id,
    user.id,
    user.role,
    req.body,
    req.files,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Product updated successfully',
    data: result,
  });
});

const getPendingReviewProducts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ProductService.getPendingReviewProductsFromDB(req.query);

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Pending review products retrieved successfully',
      pagination: result.meta,
      data: result.result,
    });
  },
);

const approveProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await ProductService.approveProductInDB(
    req.params.id,
    user.id,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Product approved and published live successfully',
    data: result,
  });
});

const rejectProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { reason } = req.body;
  const result = await ProductService.rejectProductInDB(
    req.params.id,
    user.id,
    reason,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Product rejected successfully',
    data: result,
  });
});

const getMyProducts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await ProductService.getMyProductsFromDB(user.id, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'My listings retrieved successfully',
    pagination: result.meta,
    data: result.result,
  });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  await ProductService.deleteProductFromDB(req.params.id, user.id, user.role);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Product deleted successfully',
    data: null,
  });
});

export const ProductController = {
  createProduct,
  getAllProducts,
  getPendingReviewProducts,
  approveProduct,
  rejectProduct,
  getMyProducts,
  getAllProductsForAdmin,
  getProductDetails,
  updateProduct,
  deleteProduct,
};
