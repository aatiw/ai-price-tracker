import mongoose, {Schema, Document} from "mongoose";

interface productVariant {
    platform: string;
    url: string;
    price: number;
    availability: string;
    seller?: string;
    rating?: number;
    reviews?: number;
    delivery?: string;
    lastUpdated: Date;
}

interface ProductSearchI extends Document {
    SearchQuery: string;
    searchId: string,
    results: productVariant[],
    User: Schema.Types.ObjectId;
    expiresAt: Date;
    createdAt: Date;
}

const ProductSearchSchema = new Schema<ProductSearchI>({
    SearchQuery: {type: String, required: true},
    searchId: {type: String, required: true, unique: true},
    results: [{
        platform: {type: String, required: true},
        url: {type: String, required: true},
        price: {type: Number, required: true, min: 0},
        availability: { type: String, default: 'in_stock'},
        seller: String, 
        rating: Number,
        reviews: Number,
        delivery: String,
        lastUpdated: {type: Date, default: Date.now}
    }],
    User: {type: Schema.Types.ObjectId, ref: "User", required: true},
    expiresAt:{
        type: Date,
        default: Date.now,
        expires: 3600
    }
},{timestamps: true});



ProductSearchSchema.index({ user: 1, searchId: 1 });

export const ProductSearch = mongoose.model<ProductSearchI>("ProductSearch", ProductSearchSchema);

export type { ProductSearchI, productVariant};