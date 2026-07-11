import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Dictionary } from "@/lib/i18n";

export type ActaRow = { label: string; value: string };
export type ActaChecklist = { label: string; status: "ok" | "fail" };
export type ActaDamage = { view: string; description?: string | null };

export type ActaData = {
  kind: "handover" | "return";
  dict: Dictionary;
  company: {
    name: string;
    legalName: string;
    cuit: string;
    address: string;
    phone: string;
    web: string;
  };
  dateStr: string;
  registeredBy?: string | null;
  vehicleLabel: string;
  plate: string;
  clientRows: ActaRow[];
  termRows: ActaRow[];
  km: number;
  fuelLevel: number;
  comparison?: {
    handoverKm: number;
    returnKm: number;
    kmDriven: number;
    handoverFuel: number;
    returnFuel: number;
    fuelDiff: number;
    newDamages: number;
  };
  checklist: ActaChecklist[];
  damages: ActaDamage[];
  observations?: string | null;
  signerName?: string | null;
  signatureDataUri?: string;
  photoDataUris: string[];
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, color: "#0f172a", fontFamily: "Helvetica", lineHeight: 1.4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 8,
  },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#16a34a" },
  brandSub: { fontSize: 8, color: "#64748b" },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "right", maxWidth: 200 },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
    color: "#334155",
    textTransform: "uppercase",
  },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5, paddingRight: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  label: { color: "#64748b" },
  value: { fontFamily: "Helvetica-Bold" },
  checklistWrap: { flexDirection: "row", flexWrap: "wrap" },
  li: { width: "50%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 1, paddingRight: 10 },
  ok: { color: "#16a34a", fontFamily: "Helvetica-Bold" },
  fail: { color: "#dc2626", fontFamily: "Helvetica-Bold" },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  photo: { width: 110, height: 82, objectFit: "cover", borderRadius: 3 },
  signatureBox: { marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 8 },
  signatureImg: { width: 180, height: 70, objectFit: "contain" },
  small: { fontSize: 8, color: "#64748b", marginTop: 3 },
  legalP: { fontSize: 8, color: "#334155", marginBottom: 6, textAlign: "justify" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, fontSize: 7, color: "#94a3b8", textAlign: "center" },
});

function Header({ data, title }: { data: ActaData; title: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>{data.company.name}</Text>
        <Text style={styles.brandSub}>{data.company.address}</Text>
        <Text style={styles.brandSub}>
          {data.company.phone} · {data.company.web}
        </Text>
        <Text style={styles.brandSub}>
          {data.company.legalName} · CUIT {data.company.cuit}
        </Text>
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.brandSub, { textAlign: "right" }]}>{data.dateStr}</Text>
        {data.registeredBy ? (
          <Text style={[styles.brandSub, { textAlign: "right" }]}>
            {data.dict.acta.registeredBy}: {data.registeredBy}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Rows({ rows, grid }: { rows: ActaRow[]; grid?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <View style={grid ? styles.grid2 : undefined}>
      {rows.map((r, i) => (
        <View key={i} style={grid ? styles.cell : styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ActaDocument(props: ActaData) {
  const { dict } = props;
  const t = dict.acta;
  const kindTitle = props.kind === "handover" ? t.handoverTitle : t.returnTitle;
  const title = `${t.conditionsTitle} — ${kindTitle}`;

  return (
    <Document>
      {/* Página 1 — datos, condiciones económicas y estado del vehículo */}
      <Page size="A4" style={styles.page}>
        <Header data={props} title={title} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.clientTitle}</Text>
          <Rows rows={props.clientRows} grid />
        </View>

        {props.termRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.termsTitle}</Text>
            <Rows rows={props.termRows} grid />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.vehicleStateTitle}</Text>
          <View style={styles.grid2}>
            <View style={styles.cell}>
              <Text style={styles.label}>{t.vehicle}</Text>
              <Text style={styles.value}>{props.vehicleLabel}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>{t.plate}</Text>
              <Text style={styles.value}>{props.plate}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>{t.mileage}</Text>
              <Text style={styles.value}>{props.km.toLocaleString()} km</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>{t.fuelLevel}</Text>
              <Text style={styles.value}>{props.fuelLevel}/8</Text>
            </View>
          </View>
        </View>

        {props.comparison ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comparación con la entrega</Text>
            <View style={styles.grid2}>
              <View style={styles.cell}>
                <Text style={styles.label}>{t.kmDriven}</Text>
                <Text style={styles.value}>{props.comparison.kmDriven.toLocaleString()} km</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>{t.mileage}</Text>
                <Text style={styles.value}>
                  {props.comparison.handoverKm.toLocaleString()} → {props.comparison.returnKm.toLocaleString()}
                </Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>{t.fuelDifference}</Text>
                <Text style={styles.value}>
                  {props.comparison.handoverFuel}/8 → {props.comparison.returnFuel}/8
                </Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>{t.newDamages}</Text>
                <Text style={props.comparison.newDamages > 0 ? styles.fail : styles.value}>
                  {props.comparison.newDamages}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          <View style={styles.checklistWrap}>
            {props.checklist.map((c, i) => (
              <View style={styles.li} key={i}>
                <Text>{c.label}</Text>
                <Text style={c.status === "ok" ? styles.ok : styles.fail}>
                  {c.status === "ok" ? "OK" : "✗"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.damages}</Text>
          {props.damages.length === 0 ? (
            <Text style={styles.label}>Sin daños nuevos registrados.</Text>
          ) : (
            props.damages.map((d, i) => (
              <Text key={i}>• {d.description ? d.description : `Daño (${d.view})`}</Text>
            ))
          )}
        </View>

        {props.observations ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.observations}</Text>
            <Text>{props.observations}</Text>
          </View>
        ) : null}

        {props.photoDataUris.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos</Text>
            <View style={styles.photos}>
              {props.photoDataUris.map((src, i) => (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image key={i} src={src} style={styles.photo} />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.small}>{t.fuelPolicy}</Text>

        <Text style={styles.footer} fixed>
          {props.company.name} — Andes · {props.dateStr}
        </Text>
      </Page>

      {/* Página 2 — condiciones generales y firma */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{dict.legal.title}</Text>
          {dict.legal.paragraphs.map((p, i) => (
            <Text key={i} style={styles.legalP}>
              {p}
            </Text>
          ))}
          <Text style={styles.legalP}>{dict.legal.photoConsent}</Text>
          <Text style={styles.legalP}>{dict.legal.jurisdiction}</Text>
          <Text style={styles.legalP}>{dict.legal.acceptance}</Text>
        </View>

        <View style={[styles.section, styles.signatureBox]}>
          <Text style={styles.sectionTitle}>{t.signature}</Text>
          <Text style={styles.small}>{dict.signature.legal}</Text>
          {props.signatureDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={props.signatureDataUri} style={styles.signatureImg} />
          ) : null}
          {props.signerName ? <Text style={styles.value}>{props.signerName}</Text> : null}
          {props.registeredBy ? (
            <Text style={styles.small}>
              {t.registeredBy}: {props.registeredBy}
            </Text>
          ) : null}
        </View>

        <Text style={styles.footer} fixed>
          {props.company.name} — Andes · {props.dateStr}
        </Text>
      </Page>
    </Document>
  );
}
