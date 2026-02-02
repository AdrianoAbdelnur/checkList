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
      default: 'user',
    },
  },
  {
    versionKey: false,
  }
)

const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
export default User
