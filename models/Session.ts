import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISession extends Document {
  token: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

const SessionSchema = new Schema<ISession>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      expires: 0, 
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
)

const Session: Model<ISession> = (mongoose.models.Session as Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema)
export default Session
