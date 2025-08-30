import mongoose, {Schema, Document} from "mongoose";
import bcrypt from 'bcrypt';

interface userI extends Document {
    email: string;
    password?: string | undefined;
    name: string;
    isEmailVerified: boolean;
    googleId: string;
    authProviders: 'local' | 'google';
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
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
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    resetPasswordExpires: Date,
    resetPasswordToken: String
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
        const salt = await bcrypt.genSalt(15);
        this.password = await bcrypt.hash(this.password, salt);
        next()
    } catch (error: any) {
        return next(error);
    }
});

userSchema.methods.comparePasswords = async function(candidatePassword: string): Promise<Boolean> {
    return bcrypt.compare(candidatePassword, this.password)
};

export const User = mongoose.model<userI>("User", userSchema);

export type {userI};