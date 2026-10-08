import { Router } from 'express';
import duprRoutes from './duprRoutes';
import paymentRoutes from './paymentRoutes';
import otpRoutes from './otpRoutes';
import userRoutes from './userRoutes';
import auctionRoutes from './auctionRoutes';
import aiChatRoutes from './aiChatRoutes';
import leagueRoutes from './leagueRoutes';

const router = Router();

// Mount DUPR routes
router.use('/dupr', duprRoutes);

// Mount Payment routes
router.use('/payment', paymentRoutes);

// Mount OTP routes
router.use('/otp', otpRoutes);

// Mount User routes
router.use('/user', userRoutes);

// Mount Auction routes
router.use('/auction', auctionRoutes);

// Mount League team registration routes
router.use('/leagues', leagueRoutes);

// Mount AI Chat proxy routes
router.use('/ai', aiChatRoutes);

export default router;