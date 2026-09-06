"use client";

import { SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignConversation } from "@/app/(app)/whatsapp/actions";

export function AssignForm({
  conversationId,
  users,
  assignedToId,
}: {
  conversationId: string;
  users: { id: string; name: string }[];
  assignedToId: string | null;
}) {
  return (
    <form action={assignConversation.bind(null, conversationId)} className="flex items-end gap-2">
      <SelectField id="assignedToId" label="Asignado a" defaultValue={assignedToId ?? ""} className="h-10">
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </SelectField>
      <SubmitButton pendingLabel="Guardando…" variant="secondary" className="h-10">
        Guardar
      </SubmitButton>
    </form>
  );
}
