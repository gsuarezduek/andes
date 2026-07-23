import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { ClientSection } from "./sections/client-section";
import { AuthorizedDriversSection } from "./sections/authorized-drivers-section";
import { TermsSection } from "./sections/terms-section";
import { VehicleStateSection } from "./sections/vehicle-state-section";
import { ComparisonSection } from "./sections/comparison-section";
import { SettlementSection } from "./sections/settlement-section";
import { ChecklistSection } from "./sections/checklist-section";
import { DamagesSection } from "./sections/damages-section";
import { ObservationsSection } from "./sections/observations-section";
import { PhotosSection } from "./sections/photos-section";
import { LegalSection } from "./sections/legal-section";
import { SignatureSection } from "./sections/signature-section";
import type { ActaData, ActaRow, ActaChecklist, ActaDamage } from "./types";

export type { ActaData, ActaRow, ActaChecklist, ActaDamage };

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

        <ClientSection data={props} />
        <AuthorizedDriversSection data={props} />
        <TermsSection data={props} />
        <VehicleStateSection data={props} />
        <ComparisonSection data={props} />
        <SettlementSection data={props} />
        <ChecklistSection data={props} />
        <DamagesSection data={props} />
        <ObservationsSection data={props} />
        <PhotosSection data={props} />

        <Text style={styles.small}>{t.fuelPolicy}</Text>

        <Footer companyName={props.company.name} dateStr={props.dateStr} />
      </Page>

      {/* Página 2 — condiciones generales y firma */}
      <Page size="A4" style={styles.page}>
        <LegalSection dict={dict} />
        <SignatureSection data={props} />

        <Footer companyName={props.company.name} dateStr={props.dateStr} />
      </Page>
    </Document>
  );
}
