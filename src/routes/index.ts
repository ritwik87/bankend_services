import { Router } from 'express';
import duprRoutes from './duprRoutes';
import paymentRoutes from './paymentRoutes';
import otpRoutes from './otpRoutes';
import userRoutes from './userRoutes';

const router = Router();

// Mount DUPR routes
router.use('/dupr', duprRoutes);

// Mount Payment routes
router.use('/payment', paymentRoutes);

// Mount OTP routes
router.use('/otp', otpRoutes);

// Mount User routes
router.use('/user', userRoutes);

export default router;