import { Router } from 'express';
import duprRoutes from './duprRoutes';
import paymentRoutes from './paymentRoutes';
import otpRoutes from './otpRoutes';

const router = Router();

// Mount DUPR routes
router.use('/dupr', duprRoutes);

// Mount Payment routes
router.use('/payment', paymentRoutes);

// Mount OTP routes
router.use('/otp', otpRoutes);

export default router;