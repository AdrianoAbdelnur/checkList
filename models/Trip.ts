import { Schema, model, models } from "mongoose";

const TripSchema = new Schema(
  {
    uniqueKey: { type: String, required: true, unique: true, index: true },
    tripDateKey: { type: String, required: true, index: true },
    tripDate: { type: Date, required: true, index: true },

    solicitudRaw: { type: String, default: "" },
    solicitudAt: { type: Date, required: false },
    tipo: { type: String, default: "" },
    dominio: { type: String, default: "", index: true },
    viajeRaw: { type: String, default: "" },
    assignedTemplateIds: { type: [String], default: [] },
    assignedInspectorAssignments: {
      type: [
        {
          templateId: { type: String, required: true },
          inspectorId: { type: String, required: true },
        },
      ],
      default: [],
    },

    sourceFile: { type: String, default: "" },
    importBatchId: { type: String, default: "", index: true },

    uploadedBy: {
      id: { type: String, required: false },
      email: { type: String, required: false },
      firstName: { type: String, required: false },
      lastName: { type: String, required: false },
      role: { type: String, required: false },
    },
  },
  { timestamps: true }
);

TripSchema.index({ tripDateKey: 1, dominio: 1, tipo: 1 });

export default models.Trip || model("Trip", TripSchema);
