-- Restaura las reservas de habitaciones que el sync canceló por error: Airbnb y
-- Booking sacan la estadía del iCal desde el día de entrada, y el sync lo tomaba
-- como una cancelación. Firma del error: importada por iCal (feed_id) y
-- cancelada el día de entrada o después (hora de Mendoza). Las importadas solo
-- las cancela el sync (la cancelación a mano es solo para reservas manuales).
UPDATE "room_bookings"
SET "status" = 'confirmed', "cancelled_at" = NULL
WHERE "status" = 'cancelled'
  AND "external_uid" IS NOT NULL
  AND "source" <> 'manual'
  AND ("cancelled_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Mendoza')::date >= "start_date";
