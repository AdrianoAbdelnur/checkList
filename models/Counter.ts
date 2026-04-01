import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICounter extends Document {
  key: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  },
);

const Counter: Model<ICounter> =
  (mongoose.models.Counter as Model<ICounter>) || mongoose.model<ICounter>("Counter", CounterSchema);

export default Counter;
