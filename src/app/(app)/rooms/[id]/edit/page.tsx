import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { getRoomDetail } from "@/lib/rooms/queries";
import { RoomForm } from "@/components/rooms/room-form";
import { updateRoom } from "../../actions";

export const metadata: Metadata = { title: "Editar habitación — Andes" };

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getRoomDetail(id);
  if (!detail) notFound();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar habitación</h1>
      <RoomForm action={updateRoom.bind(null, id)} room={detail.room} cancelHref={`/rooms/${id}`} />
    </div>
  );
}
