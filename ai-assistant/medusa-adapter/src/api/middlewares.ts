import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"

import { AdminAssistantReindexSchema } from "./admin/assistant/reindex/route"
import { AdminAssistantReindexProcessSchema } from "./admin/assistant/reindex/process/route"

const adminAuth = authenticate("user", ["session", "bearer", "api-key"])

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/assistant/reindex",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminAssistantReindexSchema)],
    },
    {
      matcher: "/admin/assistant/reindex/process",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminAssistantReindexProcessSchema)],
    },
    {
      matcher: "/admin/assistant/reindex/intents",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/assistant/stats",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/assistant/jobs/:id",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
  ],
})
