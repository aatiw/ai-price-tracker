import mongoose, { Schema, type Document } from "mongoose";

interface PricePoint{
    date: Date;
    price: number;
    source: 'scraped' | 'historical_api' | 'manual';
    availability?: 'in_stock' | 'out_of_stock' | 'limited_stock';
}

interface PlatformData {
    url: string;
    platformProductId: string;
    currentPrice: number;
    availability: 'in_stck' | 'out_of_stock' | 'limited_stock';
    seller?: string;
    rating?: number;
    reviews?: number;
    priceHistory: PricePoint[];
    lastScraped: Date;
    isActive: boolean;
}


interface ProductI extends Document{
    title: string;
    brand?: string;
    category?: string;
    image?: string[];

    masterProductId: string;
    platforms: Map<string, PlatformData>

    user: Schema.Types.ObjectId;
    selectedPlatforms: string[];
    trackingStartDate: Date;

    historicalDataStatus: {
        hasHistoricalData: boolean;
        historicalDataForm?: Date;
        historicalDataSource?: string;
    }

    notes?: string;
    asin: string,
    bullets: [string],
    description: string,
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema = new Schema<ProductI>({
    title: {type: String, required: true, trim: true},
    brand: String,
    category: String,
    image: {type: [String], default: []},

    masterProductId: {
        type: String,
        required: true,
    },

    platforms:{
        type: Map,
        of: {
            url: {type: String, required: true},
            platformProductId: {type: String, required: true},
            currentPrice: {type: Number, required: true},
            availability: {type: String, enum:['in_stock', 'out_of_stock', 'limited_stock'] , default: 'in_stock'},
            seller: String,
            rating: Number,
            reviews: Number,
            priceHistory: [{
                date: {type: Date, required: true},
                price: {type: Number, required: true},
                source: {type: String, enum:['scraped', 'historical_api', 'manual'], default: 'scraped'},
                availability: {type: String, enum: ['in_stock', 'out_of_stock', 'limited_stock']}
            }],
            lastScraped: {type: Date, default: Date.now},
            isActive: {type: Boolean, default: true}
        }
    },

    user: {type: Schema.Types.ObjectId, required: true, ref: "User"},
    selectedPlatforms: {type: [String], required: true},
    trackingStartDate: {type: Date, default: Date.now},

    historicalDataStatus: {
        hasHistoricalData: {type: Boolean, default: false},
        historicalDataForm: Date,
        historicalDataSource: String
    },

    notes: String,
    asin: String,
    bullets: [String],
    description: String,
}, {timestamps: true});


ProductSchema.index({ user: 1 });
ProductSchema.index({ masterProductId: 1 });
ProductSchema.index({ selectedPlatforms: 1 });


export const Product = mongoose.model<ProductI>("Product", ProductSchema);
export type { ProductI, PricePoint };