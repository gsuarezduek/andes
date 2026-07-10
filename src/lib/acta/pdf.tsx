import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Dictionary } from "@/lib/i18n";

export type ActaChecklist = { label: string; status: "ok" | "fail" };
export type ActaDamage = { view: string; description?: string | null };

export type ActaData = {
  kind: "handover" | "return";
  dict: Dictionary;
  vehicleLabel: string;
  plate: string;
  clientName: string;
  dateStr: string;
  km: number;
  fuelLevel: number;
  checklist: ActaChecklist[];
  damages: ActaDamage[];
  observations?: string | null;
  signerName?: string | null;
  signatureDataUri?: string;
  photoDataUris: string[];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0f172a", fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 10,
  },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 9, color: "#64748b" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#334155",
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  label: { color: "#64748b" },
  value: { fontFamily: "Helvetica-Bold" },
  li: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  ok: { color: "#16a34a", fontFamily: "Helvetica-Bold" },
  fail: { color: "#dc2626", fontFamily: "Helvetica-Bold" },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  photo: { width: 120, height: 90, objectFit: "cover", borderRadius: 4 },
  signatureBox: { marginTop: 6, borderTop: "1px solid #e2e8f0", paddingTop: 6 },
  signatureImg: { width: 200, height: 80, objectFit: "contain" },
  legal: { fontSize: 8, color: "#64748b", marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

export function ActaDocument(props: ActaData) {
  const { dict } = props;
  const t = dict.acta;
  const title = props.kind === "handover" ? t.handoverTitle : t.returnTitle;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>MDZ Rent a Car</Text>
            <Text style={styles.brandSub}>Andes</Text>
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.brandSub}>{props.dateStr}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>{t.vehicle}</Text>
            <Text style={styles.value}>
              {props.vehicleLabel} · {props.plate}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.client}</Text>
            <Text style={styles.value}>{props.clientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.mileage}</Text>
            <Text style={styles.value}>{props.km.toLocaleString()} km</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.fuelLevel}</Text>
            <Text style={styles.value}>{props.fuelLevel}/8</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          {props.checklist.map((c, i) => (
            <View style={styles.li} key={i}>
              <Text>{c.label}</Text>
              <Text style={c.status === "ok" ? styles.ok : styles.fail}>
                {c.status === "ok" ? "OK" : "✗"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.damages}</Text>
          {props.damages.length === 0 ? (
            <Text style={styles.label}>—</Text>
          ) : (
            props.damages.map((d, i) => (
              <Text key={i}>
                • [{d.view}] {d.description ?? ""}
              </Text>
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

        <View style={[styles.section, styles.signatureBox]}>
          <Text style={styles.sectionTitle}>{t.signature}</Text>
          {props.signatureDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={props.signatureDataUri} style={styles.signatureImg} />
          ) : null}
          {props.signerName ? <Text>{props.signerName}</Text> : null}
          <Text style={styles.legal}>{dict.signature.legal}</Text>
        </View>

        <Text style={styles.footer} fixed>
          MDZ Rent a Car — Andes · {props.dateStr}
        </Text>
      </Page>
    </Document>
  );
}
