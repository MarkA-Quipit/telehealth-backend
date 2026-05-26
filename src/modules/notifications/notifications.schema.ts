// Re-export from appointments module.
// notifications live in appointments.schema.ts because they reference
// the appointments table. Import from here to keep paths consistent.
export { notifications, notificationsRelations, notificationTypeEnum } from "../appointments/appointments.schema";