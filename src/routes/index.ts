import { Router } from 'express';
import duprRoutes from './duprRoutes';

const router = Router();

// Mount DUPR routes
router.use('/dupr', duprRoutes);

export default router;