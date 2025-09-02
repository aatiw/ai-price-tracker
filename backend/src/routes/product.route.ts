import express from 'express';
import { auth } from '../middlewares/authentication.middleware.js';
import { 
    searchProducts,
    trackProduct,
    getUserProducts,
    updateProduct,
    deleteProduct,
    getProductHistory
} from '../controllers/product.controller.js';
import { productValidation } from '../middlewares/validation.middleware.js';

const router = express.Router();

router.use(auth);

router.post('/search', productValidation.search, searchProducts);
router.post('/track', productValidation.track, trackProduct);

router.get('/user', getUserProducts);
router.put('/:id', productValidation.update, updateProduct);
router.delete('/:id', deleteProduct);

router.get('/:id/history', getProductHistory);

export default router;