/**
 * Link a la orden en el admin de VikRentCar (WordPress). VikRentCar sigue
 * usando el patrón de query string "legado" de Joomla (`option=com_vikrentcar`)
 * aunque hoy corre como plugin de WordPress — verificado contra una orden real.
 */
export function vikrentcarOrderUrl(siteUrl: string, wpBookingId: number): string {
  return `${siteUrl.replace(/\/$/, "")}/wp-admin/admin.php?option=com_vikrentcar&task=editorder&cid%5B0%5D=${wpBookingId}`;
}
