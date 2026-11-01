import express, { NextFunction, Request, Response } from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import fileUploadHandler from '../../middlewares/fileUploadHandler';
import validateRequest from '../../middlewares/validateRequest';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import { CustomerService, customerStatusSchema } from './customer.service';
import catchAsync from '../../../shared/catchAsync';
const router = express.Router();
router.get('/admin/customers', auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), catchAsync(async (req, res) => {
  const result = await CustomerService.list(req.query);
  res.json({ success: true, data: result.items, pagination: result.pagination });
}));
router.patch('/admin/customers/:id/status', auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(customerStatusSchema), catchAsync(async (req, res) => {
    const adminId = (req.user as { id: string }).id;
    const customer = req.body.status === 'active'
      ? await CustomerService.unsuspend(req.params.id, adminId)
      : await CustomerService.suspend(req.params.id, req.body.reason, adminId);
    res.json({
      success: true,
      data: customer,
      message: req.body.status === 'active' ? 'Customer unsuspended' : 'Customer suspended',
    });
  }));

router.get(
  '/profile/stats',
  auth(USER_ROLES.USER),
  UserController.getProfileStats,
);
router.get(
  '/profile/stats/:userId',
  auth(USER_ROLES.USER),
  validateRequest(UserValidation.profileStatsParamsZodSchema),
  UserController.getProfileStats,
);

router.delete(
  '/profile/photo',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.deleteProfilePhoto,
);

router
  .route('/profile')
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    UserController.getUserProfile,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER),
    fileUploadHandler(),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const profileData = req.body.data
          ? JSON.parse(req.body.data)
          : req.body;
        req.body = UserValidation.updateUserZodSchema.parse(profileData);
        return UserController.updateProfile(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER),
    UserController.deleteAccount,
  );

router
  .route('/')
  .post(
    validateRequest(UserValidation.createUserZodSchema),
    UserController.createUser,
  )
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    UserController.getAllUsers,
  );

router.post(
  '/create-user',
  validateRequest(UserValidation.createUserZodSchema),
  UserController.createUser,
);

export const UserRoutes = router;
