import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  firstName?: string
  lastName?: string
  email: string
  password: string
  salt?: string
  telephone?: string
  createdAt: Date
  isDelete: boolean
  role: string
  roles?: string[]
  userNumber?: string
  tenantId?: string
  mustChangePassword?: boolean
  passwordChangedAt?: Date | null
  deletionRequestedAt?: Date | null
  deletionRequestedByUser?: boolean
  deletionRequestSource?: string | null
}

const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
    },
    telephone: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isDelete: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['inspector', 'reviewer', 'supervisor', 'manager', 'admin', 'superAdmin'],
      default: 'inspector',
    },
    roles: {
      type: [String],
      enum: ['inspector', 'reviewer', 'supervisor', 'manager', 'admin', 'superAdmin'],
      default: ['inspector'],
    },
    userNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    tenantId: {
      type: String,
      trim: true,
      default: 'general',
      index: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    deletionRequestedByUser: {
      type: Boolean,
      default: false,
    },
    deletionRequestSource: {
      type: String,
      enum: ['mobile', 'web', 'admin'],
      default: null,
    },
  },
  {
    versionKey: false,
  }
)

const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
export default User

