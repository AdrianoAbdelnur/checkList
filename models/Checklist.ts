import { Schema, model, models } from "mongoose";

const ChecklistSchema = new Schema(
  {
    templateId: { type: String, required: true, index: true },
    templateVersion: { type: Number, required: true, index: true },

    inspectorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    inspectorSnapshot: { type: Schema.Types.Mixed, default: null },

    data: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: "DRAFT", index: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: false }
);

export default models.Checklist || model("Checklist", ChecklistSchema);