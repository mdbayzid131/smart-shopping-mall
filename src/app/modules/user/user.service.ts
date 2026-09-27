import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enums/user';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
} from '../../../enums/order';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import generateOTP from '../../../util/generateOTP';
import QueryBuilder from '../../builder/QueryBuilder';
import { IUser } from './user.interface';
import { User } from './user.model';
import { Order } from '../order/order.model';
import { Product } from '../product/product.model';
import { NotificationService } from '../notification/notification.service';
import { errorLogger } from '../../../shared/logger';
import {
  isOwnedProfileImage,
  removeStoredProfileImage,
} from '../../../helpers/profileImageStorage';
import { invalidateAllProductCaches } from '../product/product-state-sync';
import {
  getFixedTestOtp,
  isFixedTestOtpEmail,
} from '../../../helpers/fixedTestOtp';
import { buildLoginOtpDoc, OTP_TTL_MS } from '../auth/auth.service';
import { logger } from '../../../shared/logger';

const getAllUsersToDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find(), query)
    .search(['name', 'email', 'contact'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    userQuery.modelQuery,
    userQuery.getPaginationInfo(),
  ]);

  return { result, meta };
};

type CreateUserPayload = Partial<IUser> & {
  firstName?: string;
  lastName?: string;
};

const toUserProfile = (user: unknown) => {
  const value = (
    user &&
    typeof user === 'object' &&
    'toJSON' in user &&
    typeof user.toJSON === 'function'
      ? user.toJSON()
      : user
  ) as Record<string, unknown>;

  delete value.password;
  delete value.authentication;
  delete value.loginOtp;
  delete value.stripeAccountId;
  delete value.stripeCustomerId;
  delete value.__v;

  let location = typeof value.location === 'string' ? value.location : null;
  let country =
    typeof value.country === 'string' && value.country.trim()
      ? value.country.trim()
      : 'UAE';
  if (country === 'UAE' && location?.includes(',')) {
    const locationParts = location.split(',').map(part => part.trim());
    if (
      locationParts.length > 1 &&
      locationParts[locationParts.length - 1].toUpperCase() === 'UAE'
    ) {
      locationParts.pop();
      location = locationParts.join(', ') || null;
    }
  }

  const phone =
    (typeof value.phone === 'string' && value.phone) ||
    (typeof value.contact === 'string' && value.contact) ||
    null;

  const rawImage = typeof value.image === 'string' ? value.image.trim() : null;
  const image =
    rawImage &&
    !rawImage.includes('profile.png') &&
    rawImage !== 'null' &&
    rawImage !== ''
      ? rawImage
      : null;
  const rawAvatar =
    typeof value.avatar === 'string' ? value.avatar.trim() : null;
  const avatar =
    rawAvatar &&
    !rawAvatar.includes('profile.png') &&
    rawAvatar !== 'null' &&
    rawAvatar !== ''
      ? rawAvatar
      : null;

  return {
    ...value,
    image,
    avatar,
    phone,
    contact: phone,
    country: country || 'UAE',
    location: location || (typeof value.address === 'string' ? value.address : null),
  };
};

const createUserToDB = async (payload: CreateUserPayload): Promise<IUser> => {
  // App users are passwordless. Enforce this even for internal callers that
  // do not pass through the HTTP validation middleware.
  const { firstName, lastName, ...userData } = payload;
  delete userData.password;
  userData.role = USER_ROLES.USER;
  userData.country = userData.country || 'UAE';
  const fullName = [firstName, lastName]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  userData.name = fullName;

  const email = userData.email?.toLowerCase().trim();
  if (!email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Email is required');
  }
  userData.email = email;

  const existingUser = await User.findOne({ email }).select('+loginOtp');
  let targetUser: IUser;

  if (existingUser) {
    if (existingUser.verified) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'User already exists! Please login instead.',
      );
    }
    // If user previously signed up but did not finish OTP verification,
    // update their details and allow re-trying sign-up with fresh OTP
    existingUser.name = fullName;
    existingUser.country = userData.country;
    targetUser = await existingUser.save();
  } else {
    userData.verified = false;
    targetUser = await User.create(userData);
  }

  // Generate OTP & build OTP documents
  const plainOtp = getFixedTestOtp(email) ?? generateOTP();
  const otpDoc = await buildLoginOtpDoc(plainOtp);

  const authentication = {
    oneTimeCode: plainOtp,
    expireAt: new Date(Date.now() + OTP_TTL_MS),
  };

  await User.findByIdAndUpdate((targetUser as any)._id, {
    $set: {
      authentication,
      loginOtp: otpDoc,
    },
  });

  if (isFixedTestOtpEmail(email)) {
    logger.warn(`[AUTH] Fixed development OTP issued for sign-up: ${email}`);
  } else {
    try {
      const createAccountTemplate = emailTemplate.createAccount({
        name: targetUser.name,
        otp: plainOtp,
        email: email,
      });
      await emailHelper.sendEmail(createAccountTemplate);
      logger.info(`[AUTH] Sign-up OTP emailed to ${email}`);
    } catch (err: any) {
      errorLogger.error(`[AUTH] Failed to send sign-up OTP email to ${email}`, err);
      const errDetail = err?.message ? ` (${err.message})` : '';
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Failed to send sign-in code${errDetail}. Please check email configuration.`,
      );
    }
  }

  return targetUser;
};

const getUserProfileFromDB = async (user: JwtPayload) => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  return toUserProfile(isExistUser);
};

const getProfileStatsFromDB = async (userId: string) => {
  const user = await User.findById(userId).select('status verified').lean();
  if (!user || user.status !== 'active' || !user.verified) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User profile not found');
  }

  const [totalProductsListed, totalProductsPurchased, earnings] =
    await Promise.all([
      Product.countDocuments({ seller: userId }),
      Order.countDocuments({
        buyer: userId,
        'payment.status': PAYMENT_STATUS.PAID,
        status: {
          $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED],
        },
      }),
      Order.aggregate<{ totalEarnings: number }>([
        {
          $match: {
            seller: user._id,
            payoutStatus: PAYOUT_STATUS.PAID,
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$sellerPayout' },
          },
        },
        { $project: { _id: 0, totalEarnings: 1 } },
      ]),
    ]);

  return {
    totalProductsListed,
    totalProductsPurchased,
    totalEarnings: Number((earnings[0]?.totalEarnings ?? 0).toFixed(2)),
    currency: config.stripe.currency.toUpperCase(),
  };
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
) => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    if (payload.image) {
      await removeStoredProfileImage(payload.image).catch(() => undefined);
    }
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (payload.phone && !payload.contact) {
    payload.contact = payload.phone;
  } else if (payload.contact && !payload.phone) {
    payload.phone = payload.contact;
  }
  if (payload.country === undefined || payload.country === '') {
    payload.country = isExistUser.country || 'UAE';
  }

  let updateDoc;
  try {
    updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
      new: true,
    });
  } catch (error) {
    if (payload.image) {
      await removeStoredProfileImage(payload.image).catch(() => undefined);
    }
    throw error;
  }

  if (!updateDoc && payload.image) {
    await removeStoredProfileImage(payload.image).catch(() => undefined);
  }
  if (updateDoc && payload.image) {
    const previousImages = new Set([isExistUser.image, isExistUser.avatar]);
    previousImages.delete(payload.image);
    for (const previousImage of previousImages) {
      try {
        await removeStoredProfileImage(previousImage);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errorLogger.error(
          `[PROFILE_IMAGE] Old image cleanup failed for user ${id}: ${message}`,
        );
      }
    }
  }

  if (updateDoc) invalidateAllProductCaches();

  return updateDoc ? toUserProfile(updateDoc) : null;
};

const deleteProfilePhotoFromDB = async (user: JwtPayload) => {
  const { id } = user;
  const existingUser = await User.findById(id);
  if (!existingUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const previousImage = existingUser.image;
  const previousAvatar = existingUser.avatar;
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: id,
      image: previousImage,
      avatar: previousAvatar,
    },
    { $set: { image: null, avatar: null } },
    { new: true },
  );
  if (!updatedUser) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Profile photo changed while it was being deleted',
    );
  }

  const storedImages = [...new Set([previousImage, previousAvatar])].filter(
    isOwnedProfileImage,
  );
  try {
    for (const storedImage of storedImages) {
      await removeStoredProfileImage(storedImage);
    }
  } catch (error) {
    await User.updateOne(
      { _id: id, image: null, avatar: null },
      { $set: { image: previousImage, avatar: previousAvatar } },
    );
    invalidateAllProductCaches();
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      'Unable to delete the profile photo from storage',
    );
  }

  invalidateAllProductCaches();
  return toUserProfile(updatedUser);
};

const deleteAccountFromDB = async (user: JwtPayload) => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const storedImages = [...new Set([isExistUser.image, isExistUser.avatar])];
  for (const storedImage of storedImages) {
    await removeStoredProfileImage(storedImage);
  }

  const deleteDoc = await User.findByIdAndDelete(id);
  await NotificationService.deleteUserNotificationData(id);
  return deleteDoc;
};

export const UserService = {
  getAllUsersToDB,
  createUserToDB,
  getUserProfileFromDB,
  getProfileStatsFromDB,
  updateProfileToDB,
  deleteProfilePhotoFromDB,
  deleteAccountFromDB,
  toUserProfile,
};
