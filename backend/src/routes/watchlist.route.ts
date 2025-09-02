import express from 'express';
import { auth } from '../middlewares/authentication.middleware.js';
import { 
    createWatchlist,
    getUserWatchlists,
    updateWatchlist,
    deleteWatchlist,
    addProductsToWatchlist,
    removeProductFromWatchlist,
    getWatchlistProducts
} from '../controllers/watchlist.controller.js';
import { watchlistValidation } from '../middlewares/validation.middleware.js';

const router = express.Router();

router.use(auth);

router.post('/', watchlistValidation.create, createWatchlist);
router.get('/user', getUserWatchlists);
router.put('/:id', watchlistValidation.update, updateWatchlist);
router.delete('/:id', deleteWatchlist);

router.post('/:id/products', watchlistValidation.addProducts, addProductsToWatchlist);
router.delete('/:id/products/:productId', removeProductFromWatchlist);
router.get('/:id/products', getWatchlistProducts);

export default router;