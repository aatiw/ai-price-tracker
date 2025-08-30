import mongoose, { type Document, Schema } from "mongoose";

interface WatchlistI extends Document {
    user: Schema.Types.ObjectId;
    name: string;
    description?: string;
    products: Schema.Types.ObjectId[];
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const WatchlistSchema = new Schema<WatchlistI>({
    user: {type: Schema.Types.ObjectId, ref:"User", required: true},
    name: {type: String, required: true, trim: true},
    description: String,
    products: [{ type: Schema.Types.ObjectId, ref:"Product"}],
    isDefault: {type: Boolean, default: false}
}, {timestamps: true});

WatchlistSchema.index({ user: 1 });

export const WatchList = mongoose.model<WatchlistI>("WatchList", WatchlistSchema);

export type {WatchlistI};