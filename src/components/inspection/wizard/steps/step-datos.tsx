import { TextField, SelectField } from "@/components/ui/fields";
import { CameraIcon, GalleryIcon, CloseIcon } from "@/components/ui/icons";
import { dropUpload } from "@/lib/client/upload-queue";
import { languageLabels, documentKindLabels } from "@/lib/labels";
import { DOC_KINDS, type Lang } from "../types";
import { newId } from "../new-id";
import type { StepContext } from "../context";

export function StepDatos({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, isHandover, addDocument } = ctx;
  return (
    <div className="flex flex-col gap-4">
      {/* Cliente: solo lectura. Se edita en el detalle del alquiler antes de la entrega. */}
      <div className="rounded-xl border border-foreground/10 p-4 text-sm">
        <p className="font-semibold">{draft.clientName || "—"}</p>
        <p className="text-foreground/60">{draft.clientEmail || "sin email"}</p>
        <p className="text-foreground/60">{draft.clientPhone || "sin teléfono"}</p>
        {draft.clientDocNumber ? <p className="text-foreground/60">Doc: {draft.clientDocNumber}</p> : null}
        {draft.clientAddress ? <p className="text-foreground/60">Domicilio: {draft.clientAddress}</p> : null}
        <p className="mt-2 text-foreground/60">{props.datesLabel}</p>
        {isHandover && (
          <p className="mt-2 text-xs text-foreground/50">
            ¿Datos incorrectos? Editalos en el detalle del alquiler antes de iniciar la entrega.
          </p>
        )}
      </div>
      {isHandover && props.bookingNote ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
          <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{props.bookingNote}</p>
        </div>
      ) : null}
      {isHandover && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground/80">Documentos del cliente (opcional)</p>
          <p className="text-xs text-foreground/50">Licencia y DNI/Pasaporte: sacá una foto o elegí una de la galería. Quedan como respaldo interno; no se envían al cliente ni figuran en el acta.</p>
          <div className="grid grid-cols-2 gap-2">
            {DOC_KINDS.map((kind) => {
              const docs = draft.documents.filter((doc) => doc.kind === kind && !doc.holderName);
              return (
                <div key={kind} className="flex flex-col gap-1.5">
                  <p className="text-center text-xs font-medium text-foreground/70">{documentKindLabels[kind]}</p>
                  <div className="flex gap-1.5">
                    <label className="flex h-11 flex-1 items-center justify-center rounded-lg border border-dashed border-foreground/30 text-center text-xs font-medium" title="Sacar foto">
                      <CameraIcon />
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addDocument(e.target.files, kind)} />
                    </label>
                    <label className="flex h-11 flex-1 items-center justify-center rounded-lg border border-dashed border-foreground/30 text-center text-xs font-medium" title="Elegir de la galería">
                      <GalleryIcon />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addDocument(e.target.files, kind)} />
                    </label>
                  </div>
                  {docs.map((doc) => (
                    <div key={doc.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={doc.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
                      {doc.status !== "done" && (
                        <span className={`absolute inset-0 flex items-center justify-center rounded-lg px-1 text-center text-[9px] leading-tight text-white ${doc.status === "error" ? "bg-red-600/80" : "bg-black/40"}`}>
                          {doc.status === "uploading" ? "Subiendo…" : doc.status === "error" ? "No subió" : "Pendiente"}
                        </span>
                      )}
                      <button type="button" onClick={() => { dropUpload(doc.id); patch({ documents: draft.documents.filter((x) => x.id !== doc.id) }); }} aria-label="Quitar documento" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isHandover && (
        <TextField id="licenseExpiry" label="Venc. licencia de conducir" type="date" value={draft.licenseExpiry} onChange={(e) => patch({ licenseExpiry: e.target.value })} />
      )}
      {isHandover && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground/80">Conductores adicionales</p>
            <button type="button" className="text-xs font-medium text-foreground/70 underline" onClick={() => patch({ additionalDrivers: [...draft.additionalDrivers, { id: newId(), name: "" }] })}>
              + Agregar conductor
            </button>
          </div>
          {draft.additionalDrivers.length === 0 ? (
            <p className="text-xs text-foreground/50">Otros conductores autorizados. Sus nombres figuran en el acta; la foto de la licencia queda como respaldo interno.</p>
          ) : null}
          {draft.additionalDrivers.map((dr, i) => {
            const drDocs = draft.documents.filter((doc) => doc.kind === "license" && doc.holderName === dr.id);
            return (
              <div key={dr.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                    placeholder={`Nombre del conductor #${i + 1}`}
                    value={dr.name}
                    onChange={(e) => patch({ additionalDrivers: draft.additionalDrivers.map((x) => (x.id === dr.id ? { ...x, name: e.target.value } : x)) })}
                  />
                  <button type="button" className="px-2 py-2 text-xs text-red-600" onClick={() => patch({ additionalDrivers: draft.additionalDrivers.filter((x) => x.id !== dr.id) })}>
                    Quitar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex h-11 items-center gap-1.5 rounded-lg border border-dashed border-foreground/30 px-3 text-xs font-medium" title="Sacar foto">
                    <CameraIcon className="size-4" /> Licencia
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addDocument(e.target.files, "license", dr.id)} />
                  </label>
                  <label className="flex h-11 items-center gap-1 rounded-lg border border-dashed border-foreground/30 px-3 text-xs font-medium" title="Elegir de la galería">
                    <GalleryIcon className="size-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => addDocument(e.target.files, "license", dr.id)} />
                  </label>
                  <div className="flex gap-1">
                    {drDocs.map((doc) => (
                      <div key={doc.id} className="relative h-14 w-14">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={doc.preview} alt="" className="h-14 w-14 rounded object-cover" />
                        {doc.status !== "done" && (
                          <span className={`absolute inset-0 flex items-center justify-center rounded text-[8px] text-white ${doc.status === "error" ? "bg-red-600/80" : "bg-black/40"}`}>
                            {doc.status === "error" ? "✕" : "…"}
                          </span>
                        )}
                        <button type="button" onClick={() => { dropUpload(doc.id); patch({ documents: draft.documents.filter((x) => x.id !== doc.id) }); }} aria-label="Quitar foto de licencia" className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                          <CloseIcon className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {props.vehicle ? (
        <div className="rounded-xl border border-foreground/10 p-4 text-sm">
          <span className="text-foreground/60">Vehículo: </span>
          <span className="font-medium">{props.vehicle.label}</span>
        </div>
      ) : (
        <SelectField id="vehicleId" label="Vehículo" hint="Reserva sin unidad asignada" value={draft.vehicleId} onChange={(e) => patch({ vehicleId: e.target.value })}>
          <option value="">Elegir vehículo…</option>
          {props.vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </SelectField>
      )}
      <SelectField id="language" label="Idioma del cliente" hint="Para el acta y los emails" value={draft.language} onChange={(e) => patch({ language: e.target.value as Lang })}>
        {Object.entries(languageLabels).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </SelectField>
    </div>
  );
}
