import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { Rows } from "../components/rows";
import type { ActaData } from "../types";

export function ClientSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.clientTitle}</Text>
      <Rows rows={data.clientRows} grid />
    </View>
  );
}
