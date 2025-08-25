import { Router } from 'express';
import duprRoutes from './duprRoutes';
import paymentRoutes from './paymentRoutes';

const router = Router();

// Mount DUPR routes
router.use('/dupr', duprRoutes);

// Mount Payment routes
router.use('/payment', paymentRoutes);

export default router;