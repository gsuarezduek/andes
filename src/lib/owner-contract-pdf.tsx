import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/contract";
import {
  OWNER_CONTRACT_DOC_TITLE,
  parseClauses,
  type ConditionGroup,
} from "@/lib/owner-contract";

/** Sigue el modelo de contrato que usa la empresa: encabezado, datos, estado, cláusulas y firmas. */
export type OwnerContractPdfData = {
  number: number;
  textTitle: string;
  textBody: string;
  place: string;
  dateLabel: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  ownerName: string;
  ownerDocNumber: string;
  ownerAddress: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehiclePlate: string;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  commercialTerms: string | null;
  km: number;
  fuelLevel: number;
  fuelLevels: number;
  condition: ConditionGroup[];
  observations: string | null;
  companySignerName: string;
  companySignatureDataUri?: string;
  ownerSignerName: string;
  ownerSignatureDataUri?: string;
};

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingHorizontal: 40, paddingBottom: 45, fontSize: 9.5, color: "#111827", fontFamily: "Helvetica", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1.5px solid #111827", paddingBottom: 8 },
  contact: { fontSize: 8.5, color: "#374151" },
  brand: { fontSize: 22, fontFamily: "Helvetica-BoldOblique", textAlign: "right", lineHeight: 1 },
  brandSub: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 2.5, textAlign: "right" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginTop: 12 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  heading: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  paragraph: { marginBottom: 5, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: 3, paddingLeft: 8 },
  bullet: { width: 10 },
  listText: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", marginBottom: 2 },
  rowLabel: { width: 95, color: "#4b5563" },
  rowValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  conditionWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  conditionGroup: { width: "50%", paddingRight: 12, marginBottom: 6 },
  conditionTitle: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  signatures: { flexDirection: "row", gap: 24, marginTop: 16 },
  signature: { flex: 1, borderTop: "1px solid #9ca3af", paddingTop: 5 },
  signatureLabel: { fontSize: 8.5, color: "#4b5563" },
  signatureImg: { height: 70, objectFit: "contain", objectPositionX: 0 },
  signatureEmpty: { height: 70 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#6b7280" },
});

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Clauses({ body }: { body: string }) {
  return (
    <>
      {parseClauses(body).map((block, i) => {
        if (block.kind === "heading") return <Text key={i} style={styles.heading} minPresenceAhead={40}>{block.text}</Text>;
        if (block.kind === "paragraph") return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
        return (
          <View key={i}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

export function OwnerContractDocument(d: OwnerContractPdfData) {
  return (
    <Document title={`${d.textTitle} N.º ${d.number}`} author={COMPANY.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.contact}>{COMPANY.phone}</Text>
            <Text style={styles.contact}>{COMPANY.address}</Text>
            <Text style={styles.contact}>{COMPANY.web}</Text>
          </View>
          <View>
            <Text style={styles.brand}>mdz</Text>
            <Text style={styles.brandSub}>RENT A CAR</Text>
          </View>
        </View>

        <Text style={styles.title}>{OWNER_CONTRACT_DOC_TITLE}</Text>
        <View style={styles.meta}>
          <Text>Lugar: <Text style={styles.bold}>{d.place}</Text></Text>
          <Text>Fecha: <Text style={styles.bold}>{d.dateLabel}</Text></Text>
          <Text>Contrato N.º <Text style={styles.bold}>{d.number}</Text></Text>
        </View>

        <Text style={[styles.paragraph, { marginTop: 10 }]}>
          Entre <Text style={styles.bold}>{COMPANY.legalName}</Text>, CUIT {COMPANY.cuit}, con domicilio en {COMPANY.address}, en
          adelante <Text style={styles.bold}>MDZ RENT A CAR</Text>, y <Text style={styles.bold}>{d.ownerName}</Text>, documento{" "}
          <Text style={styles.bold}>{d.ownerDocNumber}</Text>, con domicilio real en <Text style={styles.bold}>{d.ownerAddress}</Text>, en
          adelante el <Text style={styles.bold}>PROPIETARIO</Text>, convienen celebrar el presente {d.textTitle}, sujeto a las
          siguientes condiciones.
        </Text>
        {d.ownerEmail || d.ownerPhone ? (
          <Text style={styles.paragraph}>
            Contacto del PROPIETARIO: {[d.ownerEmail, d.ownerPhone].filter(Boolean).join(" · ")}.
          </Text>
        ) : null}

        <Text style={styles.heading}>Vehículo cedido</Text>
        <Row label="Marca / Modelo" value={`${d.vehicleBrand} ${d.vehicleModel}`} />
        <Row label="Año" value={d.vehicleYear} />
        <Row label="Dominio" value={d.vehiclePlate} />
        <Row label="Aseguradora" value={d.insuranceCompany} />
        <Row label="Póliza" value={d.insurancePolicyNumber} />

        <Text style={styles.heading}>Plazo de cesión</Text>
        <Text>Desde el día <Text style={styles.bold}>{d.startDate}</Text>, hora <Text style={styles.bold}>{d.startTime}</Text>.</Text>
        <Text>Hasta el día <Text style={styles.bold}>{d.endDate}</Text>, hora <Text style={styles.bold}>{d.endTime}</Text>.</Text>

        {d.commercialTerms ? (
          <>
            <Text style={styles.heading}>Condiciones comerciales y particulares</Text>
            <Text style={styles.paragraph}>{d.commercialTerms}</Text>
          </>
        ) : null}

        <View wrap={false}>
          <Text style={styles.heading}>Check list – Estado del vehículo al ingreso</Text>
          <Text style={{ marginBottom: 5 }}>
            Kilometraje: <Text style={styles.bold}>{d.km.toLocaleString("es-AR")} km</Text>
            {"     "}Nivel de combustible: <Text style={styles.bold}>{d.fuelLevel}/{d.fuelLevels}</Text>
          </Text>
          <View style={styles.conditionWrap}>
            {d.condition.map((group) => (
              <View key={group.title} style={styles.conditionGroup}>
                <Text style={styles.conditionTitle}>{group.title}</Text>
                {group.lines.map((line, i) => (
                  <Text key={i}>{line.map((o) => `(${o.selected ? "X" : "  "}) ${o.label}`).join("   ")}</Text>
                ))}
              </View>
            ))}
          </View>
          {d.observations ? (
            <>
              <Text style={styles.conditionTitle}>Observaciones</Text>
              <Text style={styles.paragraph}>{d.observations}</Text>
            </>
          ) : null}
        </View>

        {/* Las cláusulas cierran con "Conformidad y firmas": las firmas van inmediatamente después. */}
        <Clauses body={d.textBody} />

        <View wrap={false} style={styles.signatures}>
          <Signature party="Por MDZ RENT A CAR" name={d.companySignerName} dataUri={d.companySignatureDataUri} />
          <Signature party="PROPIETARIO" name={d.ownerSignerName} dataUri={d.ownerSignatureDataUri} />
        </View>

        <View style={styles.footer} fixed>
          <Text>MDZ Rent a Car — Contrato de cesión N.º {d.number}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Signature({ party, name, dataUri }: { party: string; name: string; dataUri?: string }) {
  return (
    <View style={styles.signature}>
      <Text style={styles.signatureLabel}>{party}</Text>
      {dataUri ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={dataUri} style={styles.signatureImg} />
      ) : (
        <View style={styles.signatureEmpty} />
      )}
      <Text style={styles.bold}>{name}</Text>
    </View>
  );
}
