import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { Rows } from "../components/rows";
import type { ActaData } from "../types";

export function TermsSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  if (data.termRows.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.termsTitle}</Text>
      <Rows rows={data.termRows} grid />
    </View>
  );
}
