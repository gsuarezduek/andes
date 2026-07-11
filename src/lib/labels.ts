import type {
  VehicleStatus,
  RentalStatus,
  RentalOrigin,
  Language,
  UserRole,
  MaintenanceType,
} from "@prisma/client";

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  service: "Service",
  repair: "Arreglo",
  expense: "Gasto",
  note: "Nota",
};

// Etiquetas en español (AR) para los enums, para la UI de empleados.

export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  available: "Disponible",
  rented: "Alquilado",
  out_of_service: "Fuera de servicio",
};

export const rentalStatusLabels: Record<RentalStatus, string> = {
  reserved: "Reservado",
  active: "Activo",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const rentalOriginLabels: Record<RentalOrigin, string> = {
  vikrentcar: "VikRentCar",
  manual: "Manual",
};

export const languageLabels: Record<Language, string> = {
  es: "Español",
  en: "Inglés",
};

export const userRoleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  empleado: "Empleado",
};
