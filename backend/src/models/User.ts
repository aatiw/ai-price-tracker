import mongoose, {Schema, Document, Types} from "mongoose";
import bcrypt from 'bcrypt';

interface userI extends Document {
    _id: Types.ObjectId;
    email: string;
    password?: string | undefined;
    name: string;
    isEmailVerified?: boolean;
    googleId: string;
    authProviders: ('local' | 'google')[];
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    lastLogin: Date;
    createdAt: Date;
    updatedAt: Date;
    searchCount: number;
    searchLimitResetsAt?: Date | null;

    comparePasswords(candidatePassword: string): Promise<boolean>;
};

const userSchema = new  Schema<userI>({
    email: {type: String, required: true, unique: true, trim: true},
    password : {
        type: String, 
        required: false, 
        minLength: 6},
    name: {type: String, trim: true, required: true},
    isEmailVerified: {type: Boolean, default: false},
    googleId: {type: String, unique: true, sparse: true},
    authProviders: {
        type: [String],
        enum: ['local', 'google'],
        default: ['local']
    },
    resetPasswordExpires: Date,
    resetPasswordToken: String,
    lastLogin: {type: Date},
    searchCount: {
        type: Number,
        default: 0
    },
    searchLimitResetsAt: {
        type: Date
    }
},{
    timestamps: true,
    toJSON: {transform:(doc, ret) => {
        delete ret.password;
        return ret;
    }}
});

userSchema.index({ resetPasswordToken: 1 }, { sparse: true });


userSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    };

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next()
    } catch (error: any) {
        return next(error);
    }
});

userSchema.methods.comparePasswords = async function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password)
};

export const User = mongoose.model<userI>("User", userSchema);

export type {userI};