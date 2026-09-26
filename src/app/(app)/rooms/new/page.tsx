import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { RoomForm } from "@/components/rooms/room-form";
import { createRoom } from "../actions";

export const metadata: Metadata = { title: "Nueva habitación — Andes" };

export default async function NewRoomPage() {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nueva habitación</h1>
      <RoomForm action={createRoom} cancelHref="/rooms" />
    </div>
  );
}
