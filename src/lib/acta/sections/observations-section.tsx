import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ActaData } from "../types";

export function ObservationsSection({ data }: { data: ActaData }) {
  const t = data.dict.acta;
  if (!data.observations) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.observations}</Text>
      <Text>{data.observations}</Text>
    </View>
  );
}
