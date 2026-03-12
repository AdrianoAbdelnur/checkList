import { Schema, model, models } from "mongoose";

const ChecklistTemplateSchema = new Schema(
  {
    id: { type: String, required: false, index: true },
    templateId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    sections: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

ChecklistTemplateSchema.index({ templateId: 1, version: 1 }, { unique: true });

export default models.ChecklistTemplate || model("ChecklistTemplate", ChecklistTemplateSchema);
