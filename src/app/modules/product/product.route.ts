import express, { NextFunction, Request, Response } from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth, { optionalAuth } from '../../middlewares/auth';
import fileUploadHandler from '../../middlewares/fileUploadHandler';
import validateRequest from '../../middlewares/validateRequest';
import { ProductController } from './product.controller';
import { ProductValidation } from './product.validation';

const router = express.Router();

// Admin endpoints
router.get(
  '/admin/pending-review',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProductController.getPendingReviewProducts,
);

router.patch(
  '/admin/:id/approve',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(ProductValidation.approveProductZodSchema),
  ProductController.approveProduct,
);

router.patch(
  '/admin/:id/reject',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(ProductValidation.rejectProductZodSchema),
  ProductController.rejectProduct,
);

router.get(
  '/admin/all',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProductController.getAllProductsForAdmin,
);

router.get(
  '/my-products',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ProductController.getMyProducts,
);

router
  .route('/')
  .get(optionalAuth, ProductController.getAllProducts)
  .post(
    auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        let productData;

        // Handle both cases: JSON in data field or individual form fields
        if (req.body.data) {
          productData = JSON.parse(req.body.data);
        } else {
          // If price is a string from form data, convert to number
          productData = {
            ...req.body,
            price: req.body.price ? Number(req.body.price) : undefined,
            originalPackagingAvailable:
              req.body.originalPackagingAvailable === 'true'
                ? true
                : req.body.originalPackagingAvailable === 'false'
                  ? false
                  : req.body.originalPackagingAvailable,
          };
        }

        // Validate the data
        const validatedData =
          ProductValidation.createProductZodSchema.parse(productData);


        req.body = validatedData;
        return ProductController.createProduct(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

router
  .route('/:id')
  .get(ProductController.getProductDetails)
  .patch(
    auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        let productData;

        // Handle both cases: JSON in data field (for multipart) or individual body fields
        if (req.body.data) {
          productData =
            typeof req.body.data === 'string'
              ? JSON.parse(req.body.data)
              : req.body.data;
        } else {
          productData = {
            ...req.body,
            price:
              req.body.price !== undefined && req.body.price !== ''
                ? Number(req.body.price)
                : undefined,
            originalPackagingAvailable:
              req.body.originalPackagingAvailable === 'true'
                ? true
                : req.body.originalPackagingAvailable === 'false'
                  ? false
                  : req.body.originalPackagingAvailable,
          };
        }

        // Clean undefined values
        Object.keys(productData).forEach(
          key => productData[key] === undefined && delete productData[key],
        );

        // Validate the data against body schema
        const validatedData =
          ProductValidation.updateProductZodSchema.shape.body.parse(
            productData,
          );

        req.body = validatedData;
        return ProductController.updateProduct(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  )
  .delete(
    auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    ProductController.deleteProduct,
  );

export const ProductRoutes = router;
