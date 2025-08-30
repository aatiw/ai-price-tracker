import { Product, type ProductI, type PricePoint } from '../models/Product';

export const addProductPricePoint = async (
  masterProductId: string,
  platformName: string,
  newPricePoint: PricePoint
): Promise<ProductI> => {
  try {
    const product = await Product.findOne({ masterProductId });
    if (!product) {
      throw new Error(`Product with id "${masterProductId}" not found.`);
    }

    if (!product.platforms.has(platformName)) {
      throw new Error(`Platform "${platformName}" not found for product "${masterProductId}".`);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { masterProductId },
      {
        $push: {
          [`platforms.${platformName}.priceHistory`]: {
            $each: [newPricePoint],
            $slice: -10 
          }
        },
        $set: {
          [`platforms.${platformName}.currentPrice`]: newPricePoint.price,
          [`platforms.${platformName}.lastScraped`]: new Date(),
          ...(newPricePoint.availability && {
            [`platforms.${platformName}.availability`]: newPricePoint.availability
          })
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error(`Failed to update product "${masterProductId}".`);
    }

    console.log("Successfully updated product price history.");
    return updatedProduct;
  } catch (error) {
    console.error("Error updating price point:", error);
    throw error;
  }
};
